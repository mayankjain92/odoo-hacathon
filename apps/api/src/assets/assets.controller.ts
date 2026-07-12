import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("assets")
@Controller("assets")
export class AssetsController {
  @Get("status")
  status() {
    return { module: "assets", ready: false };
  }
}
