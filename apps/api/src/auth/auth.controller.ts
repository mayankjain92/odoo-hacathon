import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  @Get("status")
  status() {
    return {
      module: "auth",
      ready: false,
      endpoints: ["POST /auth/signup", "POST /auth/login", "POST /auth/refresh"],
    };
  }
}
