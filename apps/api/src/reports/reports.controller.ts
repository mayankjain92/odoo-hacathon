import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@assetflow/shared";
import { ReportsService } from "./reports.service";
import { ReportDateRangeDto } from "./dto/report-date-range.dto";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── Dashboard KPIs ─────────────────────────────────────────────
  @Get("dashboard")
  @ApiOperation({ summary: "Get dashboard KPIs (asset counts, overdue, active bookings, utilization rate)" })
  getDashboardKpis() {
    return this.reportsService.getDashboardKpis();
  }

  // ─── Asset Utilization ──────────────────────────────────────────
  @Get("utilization")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Get asset utilization report for the given period" })
  getAssetUtilization(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getAssetUtilization(query);
  }

  // ─── Asset Status Distribution ──────────────────────────────────
  @Get("asset-status")
  @ApiOperation({ summary: "Get asset count grouped by lifecycle status" })
  getAssetStatusDistribution(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getAssetStatusDistribution(query);
  }

  // ─── Maintenance Frequency ─────────────────────────────────────
  @Get("maintenance-frequency")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Get maintenance request frequency per asset with priority & status breakdown" })
  getMaintenanceFrequency(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getMaintenanceFrequency(query);
  }

  // ─── Department Summary ────────────────────────────────────────
  @Get("department-summary")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Get per-department summary: employees, assets, allocations, overdue, maintenance" })
  getDepartmentSummary(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getDepartmentSummary(query);
  }

  // ─── Booking Heatmap ───────────────────────────────────────────
  @Get("booking-heatmap")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Get booking heatmap (day-of-week × hour-of-day grid) with peak detection" })
  getBookingHeatmap(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getBookingHeatmap(query);
  }

  // ─── Category Report ───────────────────────────────────────────
  @Get("categories")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Get category-wise asset breakdown with acquisition cost aggregates" })
  getCategoryReport() {
    return this.reportsService.getCategoryReport();
  }

  // ─── Allocation Trend ──────────────────────────────────────────
  @Get("allocation-trend")
  @Roles(Role.Admin, Role.AssetManager, Role.DepartmentHead)
  @ApiOperation({ summary: "Get allocation/return trend over time with overdue counts" })
  getAllocationTrend(@Query() query: ReportDateRangeDto) {
    return this.reportsService.getAllocationTrend(query);
  }

  // ─── CSV EXPORTS ───────────────────────────────────────────────

  @Get("export/assets")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Export assets directory as CSV" })
  @ApiProduces("text/csv")
  async exportAssetsCsv(
    @Query() query: ReportDateRangeDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportAssetsCsv(query);
    this.sendCsv(res, csv, "assets-report");
  }

  @Get("export/allocations")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Export allocations as CSV" })
  @ApiProduces("text/csv")
  async exportAllocationsCsv(
    @Query() query: ReportDateRangeDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportAllocationsCsv(query);
    this.sendCsv(res, csv, "allocations-report");
  }

  @Get("export/bookings")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Export bookings as CSV" })
  @ApiProduces("text/csv")
  async exportBookingsCsv(
    @Query() query: ReportDateRangeDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportBookingsCsv(query);
    this.sendCsv(res, csv, "bookings-report");
  }

  @Get("export/maintenance")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Export maintenance requests as CSV" })
  @ApiProduces("text/csv")
  async exportMaintenanceCsv(
    @Query() query: ReportDateRangeDto,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportMaintenanceCsv(query);
    this.sendCsv(res, csv, "maintenance-report");
  }

  // ─── Helper ────────────────────────────────────────────────────

  private sendCsv(res: Response, csv: string, filenamePrefix: string) {
    const timestamp = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filenamePrefix}-${timestamp}.csv"`,
    );
    res.send(csv);
  }
}
