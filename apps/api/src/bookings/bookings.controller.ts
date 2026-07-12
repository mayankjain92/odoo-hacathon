import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("bookings")
@Controller("bookings")
export class BookingsController {
  @Get("status")
  status() {
    return { module: "bookings", ready: false };
  }
}
