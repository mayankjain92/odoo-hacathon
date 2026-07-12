import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ActivityLogService } from "./activity-log.service";
import { ActivityLogQueryDto } from "./dto/activity-log.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@assetflow/shared";

@ApiTags("activity-logs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("activity-logs")
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Get activity logs (Admin/Manager only)" })
  async getActivityLogs(@Query() query: ActivityLogQueryDto) {
    return this.activityLogService.getLogs(query);
  }
}
