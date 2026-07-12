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
import { Role, TransferStatus } from "@assetflow/shared";
import { AllocationsService } from "./allocations.service";
import { AllocateAssetDto } from "./dto/allocate-asset.dto";
import { ReturnAssetDto } from "./dto/return-asset.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ResolveTransferDto } from "./dto/resolve-transfer.dto";
import { AllocationsQueryDto } from "./dto/allocations-query.dto";

@ApiTags("allocations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("allocations")
export class AllocationsController {
  constructor(private readonly allocationsService: AllocationsService) {}

  @Post()
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Allocate an asset to an employee or department" })
  allocate(
    @Body() dto: AllocateAssetDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.allocationsService.allocateAsset(
      dto,
      actor.id,
      actor.role,
      actor.departmentId,
    );
  }

  @Post(":id/return")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Return an allocated asset by allocation ID" })
  returnAllocation(
    @Param("id") id: string,
    @Body() dto: ReturnAssetDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.allocationsService.returnAsset(
      id,
      dto,
      actor.id,
      actor.role,
      actor.departmentId,
    );
  }

  @Post("assets/:assetId/return")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Return an allocated asset by asset ID" })
  returnByAssetId(
    @Param("assetId") assetId: string,
    @Body() dto: ReturnAssetDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.allocationsService.returnAssetByAssetId(
      assetId,
      dto,
      actor.id,
      actor.role,
      actor.departmentId,
    );
  }

  @Get()
  @ApiOperation({ summary: "Get paginated list of allocations" })
  findAll(@Query() query: AllocationsQueryDto) {
    return this.allocationsService.findAll(query);
  }

  @Get("transfers")
  @ApiOperation({ summary: "Get list of transfer requests" })
  findAllTransfers(@Query("status") status?: TransferStatus) {
    return this.allocationsService.findAllTransferRequests(status);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get allocation detail by ID" })
  findOne(@Param("id") id: string) {
    return this.allocationsService.findOne(id);
  }

  @Post("transfers")
  @ApiOperation({ summary: "Request an asset transfer" })
  requestTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.allocationsService.createTransferRequest(dto, actor.id);
  }

  @Put("transfers/:id/resolve")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Resolve (Approve/Reject) a transfer request" })
  resolveTransfer(
    @Param("id") id: string,
    @Body() dto: ResolveTransferDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.allocationsService.resolveTransferRequest(
      id,
      dto,
      actor.id,
      actor.role,
      actor.departmentId,
    );
  }

  @Post("overdue-scan")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Trigger manual scan for overdue allocations" })
  triggerOverdueScan() {
    return this.allocationsService.scanOverdueAllocations();
  }
}
