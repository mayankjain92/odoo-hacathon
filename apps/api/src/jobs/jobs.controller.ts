import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("jobs")
@Controller("jobs")
export class JobsController {
  @Get("status")
  status() {
    return {
      module: "jobs",
      ready: false,
      queues: ["overdue-scan", "booking-reminders", "report-exports"],
    };
  }
}
