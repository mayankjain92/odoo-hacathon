import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("org")
@Controller("org")
export class OrgController {
  @Get("status")
  status() {
    return {
      module: "org",
      ready: false,
      resources: ["departments", "categories", "employees"],
    };
  }
}
