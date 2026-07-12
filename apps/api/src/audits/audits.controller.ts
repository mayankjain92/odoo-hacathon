import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("audits")
@Controller("audits")
export class AuditsController {
  @Get("status")
  status() {
    return { module: "audits", ready: false };
  }
}
