import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReportDateRangeDto } from "./dto/report-date-range.dto";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // DASHBOARD KPIs
  // ==========================================

  async getDashboardKpis() {
    const now = new Date();

    const [
      totalAssets,
      availableAssets,
      allocatedAssets,
      underMaintenanceAssets,
      reservedAssets,
      activeBookingsCount,
      pendingTransfers,
      overdueAllocations,
      upcomingReturns,
      pendingMaintenance,
    ] = await Promise.all([
      this.prisma.asset.count(),
      this.prisma.asset.count({ where: { status: "Available" } }),
      this.prisma.asset.count({ where: { status: "Allocated" } }),
      this.prisma.asset.count({ where: { status: "UnderMaintenance" } }),
      this.prisma.asset.count({ where: { status: "Reserved" } }),
      this.prisma.booking.count({
        where: { status: { in: ["Upcoming", "Ongoing"] } },
      }),
      this.prisma.transferRequest.count({
        where: { status: "Requested" },
      }),
      this.prisma.allocation.count({
        where: { active: true, isOverdue: true },
      }),
      // Upcoming returns: active allocations with expectedReturnAt in the next 7 days
      this.prisma.allocation.count({
        where: {
          active: true,
          isOverdue: false,
          expectedReturnAt: {
            gte: now,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.maintenanceRequest.count({
        where: { status: { in: ["Pending", "Approved"] } },
      }),
    ]);

    return {
      totalAssets,
      availableAssets,
      allocatedAssets,
      underMaintenanceAssets,
      reservedAssets,
      activeBookingsCount,
      pendingTransfers,
      overdueAllocations,
      upcomingReturns,
      pendingMaintenance,
      // Derived
      utilizationRate:
        totalAssets > 0
          ? Math.round(((allocatedAssets + reservedAssets) / totalAssets) * 100)
          : 0,
    };
  }

  // ==========================================
  // ASSET UTILIZATION REPORT
  // ==========================================

  async getAssetUtilization(query: ReportDateRangeDto) {
    const { from, to } = this.resolveDateRange(query);

    const assetWhere: any = {};
    if (query.departmentId) assetWhere.departmentId = query.departmentId;
    if (query.categoryId) assetWhere.categoryId = query.categoryId;

    // Get all assets matching the filter
    const assets = await this.prisma.asset.findMany({
      where: assetWhere,
      select: {
        id: true,
        name: true,
        assetTag: true,
        status: true,
        categoryId: true,
        departmentId: true,
        category: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const totalPeriodMs = to.getTime() - from.getTime();

    // For each asset, compute utilization based on allocations within the period
    const utilization = await Promise.all(
      assets.map(async (asset) => {
        const allocations = await this.prisma.allocation.findMany({
          where: {
            assetId: asset.id,
            allocatedAt: { lte: to },
            OR: [
              { returnedAt: null }, // still active
              { returnedAt: { gte: from } }, // returned within or after period start
            ],
          },
          select: {
            allocatedAt: true,
            returnedAt: true,
          },
        });

        // Calculate total allocated time within the period
        let allocatedMs = 0;
        for (const alloc of allocations) {
          const start = alloc.allocatedAt < from ? from : alloc.allocatedAt;
          const end = alloc.returnedAt
            ? alloc.returnedAt > to
              ? to
              : alloc.returnedAt
            : to; // still active, count until period end
          allocatedMs += Math.max(0, end.getTime() - start.getTime());
        }

        const utilizationPercent =
          totalPeriodMs > 0
            ? Math.round((allocatedMs / totalPeriodMs) * 10000) / 100
            : 0;

        return {
          assetId: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          currentStatus: asset.status,
          category: asset.category?.name || null,
          department: asset.department?.name || null,
          totalAllocations: allocations.length,
          allocatedHours: Math.round(allocatedMs / (1000 * 60 * 60) * 100) / 100,
          utilizationPercent,
        };
      }),
    );

    // Sort by utilization descending
    utilization.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    // Summary stats
    const avgUtilization =
      utilization.length > 0
        ? Math.round(
            (utilization.reduce((sum, u) => sum + u.utilizationPercent, 0) /
              utilization.length) *
              100,
          ) / 100
        : 0;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalAssets: utilization.length,
        averageUtilizationPercent: avgUtilization,
        mostUtilized: utilization[0] || null,
        leastUtilized: utilization[utilization.length - 1] || null,
      },
      data: utilization,
    };
  }

  // ==========================================
  // ASSET STATUS DISTRIBUTION
  // ==========================================

  async getAssetStatusDistribution(query: ReportDateRangeDto) {
    const where: any = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.categoryId) where.categoryId = query.categoryId;

    const assets = await this.prisma.asset.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    });

    const total = assets.reduce((sum, a) => sum + a._count.id, 0);

    const distribution = assets.map((a) => ({
      status: a.status,
      count: a._count.id,
      percentage: total > 0 ? Math.round((a._count.id / total) * 10000) / 100 : 0,
    }));

    return {
      total,
      distribution,
    };
  }

  // ==========================================
  // MAINTENANCE FREQUENCY REPORT
  // ==========================================

  async getMaintenanceFrequency(query: ReportDateRangeDto) {
    const { from, to } = this.resolveDateRange(query);

    const where: any = {
      createdAt: { gte: from, lte: to },
    };

    // Get maintenance requests in the period
    const requests = await this.prisma.maintenanceRequest.findMany({
      where,
      select: {
        id: true,
        assetId: true,
        priority: true,
        status: true,
        createdAt: true,
        asset: {
          select: {
            id: true,
            name: true,
            assetTag: true,
            categoryId: true,
            departmentId: true,
            category: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Filter by department/category if provided (via asset relation)
    const filtered = requests.filter((r) => {
      if (query.departmentId && r.asset.departmentId !== query.departmentId) return false;
      if (query.categoryId && r.asset.categoryId !== query.categoryId) return false;
      return true;
    });

    // Group by asset
    const byAsset: Record<string, {
      assetId: string;
      assetTag: string;
      name: string;
      category: string | null;
      department: string | null;
      totalRequests: number;
      byPriority: Record<string, number>;
      byStatus: Record<string, number>;
    }> = {};

    for (const req of filtered) {
      if (!byAsset[req.assetId]) {
        byAsset[req.assetId] = {
          assetId: req.asset.id,
          assetTag: req.asset.assetTag,
          name: req.asset.name,
          category: req.asset.category?.name || null,
          department: req.asset.department?.name || null,
          totalRequests: 0,
          byPriority: {},
          byStatus: {},
        };
      }
      byAsset[req.assetId].totalRequests++;
      byAsset[req.assetId].byPriority[req.priority] =
        (byAsset[req.assetId].byPriority[req.priority] || 0) + 1;
      byAsset[req.assetId].byStatus[req.status] =
        (byAsset[req.assetId].byStatus[req.status] || 0) + 1;
    }

    const assetData = Object.values(byAsset).sort(
      (a, b) => b.totalRequests - a.totalRequests,
    );

    // Group by priority summary
    const byPrioritySummary: Record<string, number> = {};
    const byStatusSummary: Record<string, number> = {};
    for (const req of filtered) {
      byPrioritySummary[req.priority] = (byPrioritySummary[req.priority] || 0) + 1;
      byStatusSummary[req.status] = (byStatusSummary[req.status] || 0) + 1;
    }

    // Monthly trend
    const monthlyTrend = this.groupByMonth(
      filtered.map((r) => r.createdAt),
    );

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalRequests: filtered.length,
        byPriority: byPrioritySummary,
        byStatus: byStatusSummary,
        topAssetsByFrequency: assetData.slice(0, 10),
      },
      monthlyTrend,
      data: assetData,
    };
  }

  // ==========================================
  // DEPARTMENT SUMMARY REPORT
  // ==========================================

  async getDepartmentSummary(query: ReportDateRangeDto) {
    const { from, to } = this.resolveDateRange(query);

    const departments = await this.prisma.department.findMany({
      where: query.departmentId ? { id: query.departmentId } : { status: "Active" },
      select: {
        id: true,
        name: true,
        status: true,
        headId: true,
        head: { select: { id: true, name: true, email: true } },
      },
    });

    const summaries = await Promise.all(
      departments.map(async (dept) => {
        const [
          totalEmployees,
          totalAssets,
          assetsByStatus,
          activeAllocations,
          overdueAllocations,
          maintenanceRequests,
          bookingsCount,
        ] = await Promise.all([
          this.prisma.user.count({
            where: { departmentId: dept.id, status: "Active" },
          }),
          this.prisma.asset.count({
            where: { departmentId: dept.id },
          }),
          this.prisma.asset.groupBy({
            by: ["status"],
            where: { departmentId: dept.id },
            _count: { id: true },
          }),
          this.prisma.allocation.count({
            where: { departmentId: dept.id, active: true },
          }),
          this.prisma.allocation.count({
            where: { departmentId: dept.id, active: true, isOverdue: true },
          }),
          this.prisma.maintenanceRequest.count({
            where: {
              asset: { departmentId: dept.id },
              createdAt: { gte: from, lte: to },
            },
          }),
          this.prisma.booking.count({
            where: {
              asset: { departmentId: dept.id },
              createdAt: { gte: from, lte: to },
            },
          }),
        ]);

        const statusBreakdown: Record<string, number> = {};
        for (const s of assetsByStatus) {
          statusBreakdown[s.status] = s._count.id;
        }

        return {
          departmentId: dept.id,
          departmentName: dept.name,
          head: dept.head,
          totalEmployees,
          totalAssets,
          assetStatusBreakdown: statusBreakdown,
          activeAllocations,
          overdueAllocations,
          maintenanceRequests,
          bookingsCount,
        };
      }),
    );

    // Sort by total assets descending
    summaries.sort((a, b) => b.totalAssets - a.totalAssets);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalDepartments: summaries.length,
      data: summaries,
    };
  }

  // ==========================================
  // BOOKING HEATMAP
  // ==========================================

  async getBookingHeatmap(query: ReportDateRangeDto) {
    const { from, to } = this.resolveDateRange(query);

    const whereBooking: any = {
      startsAt: { gte: from, lte: to },
      status: { not: "Cancelled" },
    };

    // Optionally filter by department via asset relation
    if (query.departmentId) {
      whereBooking.asset = { departmentId: query.departmentId };
    }

    const bookings = await this.prisma.booking.findMany({
      where: whereBooking,
      select: {
        startsAt: true,
        endsAt: true,
        assetId: true,
        asset: { select: { name: true, assetTag: true } },
      },
    });

    // Build heatmap: day-of-week × hour-of-day
    // 0=Sunday…6=Saturday, 0–23 hours
    const heatmap: number[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(0),
    );

    // Also build daily counts for a date-based heatmap
    const dailyCounts: Record<string, number> = {};

    for (const booking of bookings) {
      const start = booking.startsAt;
      const dayOfWeek = start.getUTCDay();
      const hour = start.getUTCHours();
      heatmap[dayOfWeek][hour]++;

      // Daily count
      const dateKey = start.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }

    // Top booked assets
    const assetBookingCounts: Record<string, { count: number; name: string; assetTag: string }> = {};
    for (const booking of bookings) {
      if (!assetBookingCounts[booking.assetId]) {
        assetBookingCounts[booking.assetId] = {
          count: 0,
          name: booking.asset.name,
          assetTag: booking.asset.assetTag,
        };
      }
      assetBookingCounts[booking.assetId].count++;
    }

    const topAssets = Object.entries(assetBookingCounts)
      .map(([assetId, data]) => ({ assetId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Peak hours
    const hourTotals = Array(24).fill(0);
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        hourTotals[hour] += heatmap[day][hour];
      }
    }

    const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

    // Day names for readability
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayTotals = heatmap.map((hours, idx) => ({
      day: dayNames[idx],
      totalBookings: hours.reduce((a, b) => a + b, 0),
    }));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalBookings: bookings.length,
        peakHour: `${peakHour.toString().padStart(2, "0")}:00`,
        peakHourBookings: hourTotals[peakHour],
        busiestDay: dayTotals.reduce((max, d) =>
          d.totalBookings > max.totalBookings ? d : max,
          dayTotals[0],
        ),
        topBookedAssets: topAssets,
      },
      heatmap: {
        labels: {
          days: dayNames,
          hours: Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`),
        },
        grid: heatmap,
      },
      dayTotals,
      dailyCounts,
    };
  }

  // ==========================================
  // CATEGORY-WISE REPORT
  // ==========================================

  async getCategoryReport() {
    const categories = await this.prisma.assetCategory.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { assets: true } },
      },
    });

    const data = await Promise.all(
      categories.map(async (cat) => {
        const statusBreakdown = await this.prisma.asset.groupBy({
          by: ["status"],
          where: { categoryId: cat.id },
          _count: { id: true },
        });

        const statusMap: Record<string, number> = {};
        for (const s of statusBreakdown) {
          statusMap[s.status] = s._count.id;
        }

        const totalValue = await this.prisma.asset.aggregate({
          where: { categoryId: cat.id },
          _sum: { acquisitionCost: true },
          _avg: { acquisitionCost: true },
        });

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          totalAssets: cat._count.assets,
          assetStatusBreakdown: statusMap,
          totalAcquisitionCost: totalValue._sum.acquisitionCost
            ? Number(totalValue._sum.acquisitionCost)
            : 0,
          averageAcquisitionCost: totalValue._avg.acquisitionCost
            ? Math.round(Number(totalValue._avg.acquisitionCost) * 100) / 100
            : 0,
        };
      }),
    );

    data.sort((a, b) => b.totalAssets - a.totalAssets);

    return {
      totalCategories: data.length,
      data,
    };
  }

  // ==========================================
  // ALLOCATION TREND REPORT
  // ==========================================

  async getAllocationTrend(query: ReportDateRangeDto) {
    const { from, to } = this.resolveDateRange(query);

    const where: any = {
      allocatedAt: { gte: from, lte: to },
    };
    if (query.departmentId) where.departmentId = query.departmentId;

    const allocations = await this.prisma.allocation.findMany({
      where,
      select: {
        allocatedAt: true,
        returnedAt: true,
        isOverdue: true,
      },
      orderBy: { allocatedAt: "asc" },
    });

    const monthlyAllocations = this.groupByMonth(
      allocations.map((a) => a.allocatedAt),
    );

    const monthlyReturns = this.groupByMonth(
      allocations
        .filter((a) => a.returnedAt)
        .map((a) => a.returnedAt!),
    );

    const overdueCount = allocations.filter((a) => a.isOverdue).length;
    const returnedCount = allocations.filter((a) => a.returnedAt).length;
    const activeCount = allocations.filter((a) => !a.returnedAt).length;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalAllocations: allocations.length,
        returned: returnedCount,
        active: activeCount,
        overdue: overdueCount,
      },
      monthlyAllocations,
      monthlyReturns,
    };
  }

  // ==========================================
  // CSV EXPORT — ASSETS
  // ==========================================

  async exportAssetsCsv(query: ReportDateRangeDto): Promise<string> {
    const where: any = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.categoryId) where.categoryId = query.categoryId;

    const assets = await this.prisma.asset.findMany({
      where,
      include: {
        category: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { assetTag: "asc" },
    });

    const headers = [
      "Asset Tag",
      "Name",
      "Serial Number",
      "Category",
      "Department",
      "Status",
      "Condition",
      "Location",
      "Acquisition Date",
      "Acquisition Cost",
      "Is Bookable",
      "Created At",
    ];

    const rows = assets.map((a) => [
      a.assetTag,
      this.csvEscape(a.name),
      a.serialNumber || "",
      a.category?.name || "",
      a.department?.name || "",
      a.status,
      a.condition || "",
      a.location || "",
      a.acquisitionDate.toISOString().split("T")[0],
      a.acquisitionCost ? Number(a.acquisitionCost).toFixed(2) : "",
      a.isSharedBookable ? "Yes" : "No",
      a.createdAt.toISOString(),
    ]);

    return this.buildCsv(headers, rows);
  }

  // ==========================================
  // CSV EXPORT — ALLOCATIONS
  // ==========================================

  async exportAllocationsCsv(query: ReportDateRangeDto): Promise<string> {
    const { from, to } = this.resolveDateRange(query);

    const where: any = {
      allocatedAt: { gte: from, lte: to },
    };
    if (query.departmentId) where.departmentId = query.departmentId;

    const allocations = await this.prisma.allocation.findMany({
      where,
      include: {
        asset: { select: { assetTag: true, name: true } },
        employee: { select: { name: true, email: true } },
        department: { select: { name: true } },
      },
      orderBy: { allocatedAt: "desc" },
    });

    const headers = [
      "Allocation ID",
      "Asset Tag",
      "Asset Name",
      "Employee",
      "Employee Email",
      "Department",
      "Allocated At",
      "Expected Return",
      "Returned At",
      "Overdue",
      "Active",
      "Return Notes",
    ];

    const rows = allocations.map((a) => [
      a.id,
      a.asset.assetTag,
      this.csvEscape(a.asset.name),
      a.employee?.name || "",
      a.employee?.email || "",
      a.department?.name || "",
      a.allocatedAt.toISOString(),
      a.expectedReturnAt ? a.expectedReturnAt.toISOString() : "",
      a.returnedAt ? a.returnedAt.toISOString() : "",
      a.isOverdue ? "Yes" : "No",
      a.active ? "Yes" : "No",
      this.csvEscape(a.returnNotes || ""),
    ]);

    return this.buildCsv(headers, rows);
  }

  // ==========================================
  // CSV EXPORT — BOOKINGS
  // ==========================================

  async exportBookingsCsv(query: ReportDateRangeDto): Promise<string> {
    const { from, to } = this.resolveDateRange(query);

    const where: any = {
      startsAt: { gte: from, lte: to },
    };

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        asset: { select: { assetTag: true, name: true, location: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    const headers = [
      "Booking ID",
      "Asset Tag",
      "Asset Name",
      "Location",
      "Booked By",
      "Email",
      "Starts At",
      "Ends At",
      "Duration (hours)",
      "Purpose",
      "Status",
      "Created At",
    ];

    const rows = bookings.map((b) => {
      const durationMs = b.endsAt.getTime() - b.startsAt.getTime();
      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
      return [
        b.id,
        b.asset.assetTag,
        this.csvEscape(b.asset.name),
        b.asset.location || "",
        b.user.name,
        b.user.email,
        b.startsAt.toISOString(),
        b.endsAt.toISOString(),
        durationHours.toString(),
        this.csvEscape(b.purpose || ""),
        b.status,
        b.createdAt.toISOString(),
      ];
    });

    return this.buildCsv(headers, rows);
  }

  // ==========================================
  // CSV EXPORT — MAINTENANCE
  // ==========================================

  async exportMaintenanceCsv(query: ReportDateRangeDto): Promise<string> {
    const { from, to } = this.resolveDateRange(query);

    const where: any = {
      createdAt: { gte: from, lte: to },
    };

    const requests = await this.prisma.maintenanceRequest.findMany({
      where,
      include: {
        asset: { select: { assetTag: true, name: true } },
        requester: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Request ID",
      "Asset Tag",
      "Asset Name",
      "Requested By",
      "Email",
      "Description",
      "Priority",
      "Status",
      "Technician",
      "Created At",
    ];

    const rows = requests.map((r) => [
      r.id,
      r.asset.assetTag,
      this.csvEscape(r.asset.name),
      r.requester.name,
      r.requester.email,
      this.csvEscape(r.description),
      r.priority,
      r.status,
      r.technician || "",
      r.createdAt.toISOString(),
    ]);

    return this.buildCsv(headers, rows);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private resolveDateRange(query: ReportDateRangeDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); // default: 30 days
    return { from, to };
  }

  private groupByMonth(dates: Date[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const date of dates) {
      const key = `${date.getFullYear()}-${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }

  private csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildCsv(headers: string[], rows: string[][]): string {
    const headerLine = headers.join(",");
    const bodyLines = rows.map((row) => row.join(","));
    return [headerLine, ...bodyLines].join("\n");
  }
}
