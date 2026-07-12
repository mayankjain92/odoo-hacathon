import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { ErrorCode, Role } from "@assetflow/shared";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { EntityStatus } from "../generated/prisma/client";
import { ApiException } from "../common/errors/api.exception";
import { PrismaService } from "../prisma/prisma.service";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { LoginDto } from "./dto/login.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { SignupDto } from "./dto/signup.dto";
import type {
  AuthSessionResponse,
  AuthTokens,
  AuthUserView,
  JwtAccessPayload,
  JwtRefreshPayload,
} from "./types/auth.types";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthSessionResponse> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "An account with this email already exists",
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Hard rule: signup always creates Employee — never elevated roles.
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        role: Role.Employee,
        status: EntityStatus.Active,
      },
    });

    await this.logActivity(user.id, "auth.signup", "User", user.id);

    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthSessionResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid email or password",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== EntityStatus.Active) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "This account is inactive",
        HttpStatus.FORBIDDEN,
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid email or password",
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.logActivity(user.id, "auth.login", "User", user.id);
    return this.issueSession(user);
  }

  async refresh(userId: string, refreshToken: string): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshTokenHash) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== EntityStatus.Active) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "This account is inactive",
        HttpStatus.FORBIDDEN,
      );
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: null },
      });
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.issueSession(user);
  }

  async me(userId: string): Promise<AuthUserView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.status !== EntityStatus.Active) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Session is invalid",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.toUserView(user);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; resetToken?: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const response: { message: string; resetToken?: string } = {
      message:
        "If an account exists for this email, password reset instructions were sent",
    };

    if (!user || user.status !== EntityStatus.Active) {
      return response;
    }

    const resetToken = randomBytes(32).toString("hex");
    const passwordResetTokenHash = this.hashToken(resetToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash,
        passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    await this.logActivity(user.id, "auth.forgot_password", "User", user.id);

    if (this.config.get<string>("AUTH_EXPOSE_RESET_TOKEN") === "true") {
      response.resetToken = resetToken;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const passwordResetTokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid or expired reset token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        refreshTokenHash: null,
      },
    });

    await this.logActivity(user.id, "auth.reset_password", "User", user.id);

    return { message: "Password updated successfully" };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    await this.logActivity(userId, "auth.logout", "User", userId);
    return { message: "Logged out" };
  }

  async validateAccessPayload(payload: JwtAccessPayload): Promise<AuthUserView> {
    if (payload.typ !== "access") {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid access token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.me(payload.sub);
  }

  async validateRefreshPayload(
    payload: JwtRefreshPayload,
    refreshToken: string,
  ): Promise<AuthUserView> {
    if (payload.typ !== "refresh" || !refreshToken) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user?.refreshTokenHash || user.status !== EntityStatus.Active) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new ApiException(
        ErrorCode.UNAUTHORIZED,
        "Invalid refresh token",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.toUserView(user);
  }

  private async issueSession(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    departmentId: string | null;
    createdAt: Date;
  }): Promise<AuthSessionResponse> {
    const tokens = await this.createTokens(user);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user: this.toUserView(user),
      tokens,
    };
  }

  private async createTokens(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<AuthTokens> {
    const accessExpires = (this.config.get<string>("JWT_ACCESS_EXPIRES") ??
      "15m") as `${number}${"s" | "m" | "h" | "d"}`;
    const refreshExpires = (this.config.get<string>("JWT_REFRESH_EXPIRES") ??
      "7d") as `${number}${"s" | "m" | "h" | "d"}`;

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: "access",
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      typ: "refresh",
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessExpires,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: refreshExpires,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: accessExpires,
    };
  }

  private toUserView(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    departmentId: string | null;
    createdAt: Date;
  }): AuthUserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      departmentId: user.departmentId,
      createdAt: user.createdAt,
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async logActivity(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: { actorId, action, entityType, entityId },
    });
  }
}
