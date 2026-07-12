import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { AuthService } from "../auth.service";
import type { AuthUserView, JwtRefreshPayload } from "../types/auth.types";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const body = req.body as { refreshToken?: string } | undefined;
          return body?.refreshToken ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: JwtRefreshPayload,
  ): Promise<AuthUserView & { refreshToken: string }> {
    const body = req.body as { refreshToken?: string } | undefined;
    const refreshToken =
      body?.refreshToken ??
      ExtractJwt.fromAuthHeaderAsBearerToken()(req) ??
      "";

    const user = await this.authService.validateRefreshPayload(
      payload,
      refreshToken,
    );

    return { ...user, refreshToken };
  }
}
