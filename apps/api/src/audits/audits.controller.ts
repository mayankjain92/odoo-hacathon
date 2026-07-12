import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserView } from "../auth/types/auth.types";
import { Role } from "@assetflow/shared";
import { AuditsService } from "./audits.service";
import { CreateAuditCycleDto } from "./dto/create-audit-cycle.dto";
import { AuditCycleQueryDto } from "./dto/audit-cycle-query.dto";
import { RecordAuditItemDto } from "./dto/record-audit-item.dto";
import { UpdateAuditStatusDto } from "./dto/update-audit-status.dto";

@ApiTags("audits")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("audits")
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post()
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Create a new audit cycle" })
  create(@Body() dto: CreateAuditCycleDto, @CurrentUser() actor: AuthUserView) {
    return this.auditsService.createCycle(dto, actor.id);
  }

  @Get()
  @ApiOperation({ summary: "List audit cycles with optional filters" })
  findAll(@Query() query: AuditCycleQueryDto) {
    return this.auditsService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get details of an audit cycle including items" })
  findOne(@Param("id") id: string) {
    return this.auditsService.findOne(id);
  }

  @Patch(":id/status")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Update status (e.g. Open -> InProgress -> Closed)" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAuditStatusDto,
    @CurrentUser() actor: AuthUserView
  ) {
    return this.auditsService.updateStatus(id, dto, actor.id);
  }

  @Post(":id/scan")
  @ApiOperation({ summary: "Record a scanned item against an In Progress audit cycle" })
  recordItem(
    @Param("id") id: string,
    @Body() dto: RecordAuditItemDto,
    @CurrentUser() actor: AuthUserView
  ) {
    return this.auditsService.recordItem(id, dto, actor.id);
  }
}
