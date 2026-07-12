import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("allocations")
@Controller("allocations")
export class AllocationsController {
  @Get("status")
  status() {
    return { module: "allocations", ready: false };
  }
}
