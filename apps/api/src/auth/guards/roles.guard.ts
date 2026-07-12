import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ErrorCode, type Role } from "@assetflow/shared";
import { HttpStatus } from "@nestjs/common";
import { ApiException } from "../../common/errors/api.exception";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthUserView } from "../types/auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUserView }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role as Role)) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "You do not have permission to perform this action",
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
