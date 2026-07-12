import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("maintenance")
@Controller("maintenance")
export class MaintenanceController {
  @Get("status")
  status() {
    return { module: "maintenance", ready: false };
  }
}
