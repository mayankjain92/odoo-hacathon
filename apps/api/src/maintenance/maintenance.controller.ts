import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUserView } from "../auth/types/auth.types";
import { Role } from "@assetflow/shared";
import { MaintenanceService } from "./maintenance.service";
import { CreateMaintenanceDto } from "./dto/create-maintenance.dto";
import { UpdateMaintenanceStatusDto } from "./dto/update-maintenance-status.dto";
import { MaintenanceQueryDto } from "./dto/maintenance-query.dto";

@ApiTags("maintenance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("maintenance")
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @ApiOperation({ summary: "Raise a new maintenance request" })
  create(
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.maintenanceService.createRequest(dto, actor.id);
  }

  @Get()
  @ApiOperation({ summary: "List maintenance requests" })
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.maintenanceService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get details of a maintenance request" })
  findOne(@Param("id") id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Put(":id/resolve")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Update/resolve a maintenance request status" })
  resolve(
    @Param("id") id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.maintenanceService.updateStatus(id, dto, actor.id);
  }
}
