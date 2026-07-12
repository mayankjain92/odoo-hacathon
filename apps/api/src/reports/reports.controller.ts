import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  @Get("status")
  status() {
    return { module: "reports", ready: false };
  }
}
