import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  @Get("status")
  status() {
    return { module: "notifications", ready: false };
  }
}
