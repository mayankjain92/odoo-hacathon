import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUserView } from "../types/auth.types";

type AuthedRequest = Request & { user?: AuthUserView };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserView => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!request.user) {
      throw new Error("CurrentUser used without authenticated request");
    }
    return request.user;
  },
);
