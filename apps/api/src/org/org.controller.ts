import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Role } from "@assetflow/shared";
import { OrgService } from "./org.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserView } from "../auth/types/auth.types";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { PromoteEmployeeDto } from "./dto/promote-employee.dto";
import { OrgQueryDto } from "./dto/org-query.dto";

@ApiTags("org")
@Controller("org")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Get("status")
  @ApiOperation({ summary: "Get module readiness status" })
  status() {
    return {
      module: "org",
      ready: true,
      resources: ["departments", "categories", "employees"],
    };
  }

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  @Post("departments")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Create a new department (Admin only)" })
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.createDepartment(dto, actor.id);
  }

  @Get("departments")
  @ApiOperation({ summary: "Get paginated list of departments" })
  findAllDepartments(@Query() query: OrgQueryDto) {
    return this.orgService.findAllDepartments(query);
  }

  @Get("departments/:id")
  @ApiOperation({ summary: "Get department detail by ID" })
  findDepartmentById(@Param("id") id: string) {
    return this.orgService.findDepartmentById(id);
  }

  @Patch("departments/:id")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Update department details (Admin only)" })
  updateDepartment(
    @Param("id") id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.updateDepartment(id, dto, actor.id);
  }

  @Delete("departments/:id")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Deactivate department / soft delete (Admin only)" })
  deactivateDepartment(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.deactivateDepartment(id, actor.id);
  }

  // ==========================================
  // ASSET CATEGORIES
  // ==========================================

  @Post("categories")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Create a new asset category (Admin only)" })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.createCategory(dto, actor.id);
  }

  @Get("categories")
  @ApiOperation({ summary: "Get paginated list of asset categories" })
  findAllCategories(@Query() query: OrgQueryDto) {
    return this.orgService.findAllCategories(query);
  }

  @Get("categories/:id")
  @ApiOperation({ summary: "Get asset category detail by ID" })
  findCategoryById(@Param("id") id: string) {
    return this.orgService.findCategoryById(id);
  }

  @Patch("categories/:id")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Update asset category details (Admin only)" })
  updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.updateCategory(id, dto, actor.id);
  }

  @Delete("categories/:id")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Delete asset category if empty (Admin only)" })
  deleteCategory(
    @Param("id") id: string,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.deleteCategory(id, actor.id);
  }

  // ==========================================
  // EMPLOYEES
  // ==========================================

  @Get("employees")
  @ApiOperation({ summary: "Get paginated list of employees" })
  findAllEmployees(@Query() query: OrgQueryDto) {
    return this.orgService.findAllEmployees(query);
  }

  @Get("employees/:id")
  @ApiOperation({ summary: "Get employee detail by ID" })
  findEmployeeById(@Param("id") id: string) {
    return this.orgService.findEmployeeById(id);
  }

  @Patch("employees/:id")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Update employee details (Admin only)" })
  updateEmployee(
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.updateEmployee(id, dto, actor.id);
  }

  @Put("employees/:id/role")
  @Roles(Role.Admin)
  @ApiOperation({ summary: "Promote/demote employee role (Admin only)" })
  promoteEmployee(
    @Param("id") id: string,
    @Body() dto: PromoteEmployeeDto,
    @CurrentUser() actor: AuthUserView,
  ) {
    return this.orgService.promoteEmployee(id, dto.role, actor.id);
  }
}
