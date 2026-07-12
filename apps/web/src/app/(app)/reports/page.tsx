"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Download,
  AlertTriangle,
  FolderOpen,
  PieChartIcon,
  Server
} from "lucide-react";

export default function ReportsPage() {
  // Queries
  const { data: utilizationRes, isLoading: utilLoading } = useQuery<{ data: any[] }>({
    queryKey: ["reports-utilization"],
    queryFn: () => apiFetch<{ data: any[] }>("/reports/utilization"),
  });

  const { data: maintenanceRes } = useQuery<{ data: any[] }>({
    queryKey: ["maintenance"],
    queryFn: () => apiFetch<{ data: any[] }>("/maintenance"),
  });

  const { data: deptsRes } = useQuery<{ data: any[] }>({
    queryKey: ["departments"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/departments"),
  });

  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=100"),
  });

  const utilization = utilizationRes?.data || [];
  const maintenance = maintenanceRes?.data || [];
  const departments = deptsRes?.data || [];
  const assets = assetsRes?.data || [];

  // Compute maintenance priority distributions
  const priorityCounts = maintenance.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    { Low: 0, Medium: 0, High: 0, Critical: 0 } as Record<string, number>
  );

  const priorityData = Object.entries(priorityCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // Recharts color palettes
  const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444"];
  const RADIAN = Math.PI / 180;

  // Compute Department allocations
  const deptAllocCounts = departments.map((dept) => {
    const allocatedCount = assets.filter(
      (a) => a.departmentId === dept.id && a.status === "Allocated"
    ).length;
    return {
      name: dept.name,
      allocated: allocatedCount,
    };
  });

  // Export CSV Data
  const handleExportCSV = () => {
    const headers = "AssetTag,Name,Category,Status,Cost,SerialNumber\n";
    const rows = assets
      .map(
        (a) =>
          `"${a.assetTag}","${a.name}","${a.categoryId}","${a.status}",${a.cost},"${a.serialNumber || ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AssetFlow_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Operational Analytics
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Analyze resource distribution metrics, category utilization rates, and maintenance trends.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 rounded-lg bg-[var(--af-surface-elevated)] border border-[var(--af-border)] px-4 py-2.5 text-xs text-white hover:bg-[var(--af-surface)] transition cursor-pointer"
        >
          <Download className="h-4 w-4 text-[var(--af-accent)]" />
          Export CSV Report
        </button>
      </div>

      {/* Grid of Visualizations */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Utilization Bar Chart */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Asset Category Utilization</h3>
          </div>
          <div className="h-72 w-full">
            {utilLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">Loading graph...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilization} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="categoryName" stroke="var(--af-muted)" fontSize={10} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--af-surface-elevated)",
                      borderColor: "var(--af-border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "white"
                    }}
                  />
                  <Bar dataKey="totalCount" name="Total Assets" fill="#1e293b" radius={[4, 4, 0, 0]} stroke="#475569" />
                  <Bar dataKey="allocatedCount" name="Allocated Assets" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Priority distribution pie chart */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4.5 w-4.5 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Maintenance Work Order Distribution</h3>
          </div>
          <div className="h-72 w-full flex items-center justify-center">
            {maintenance.length === 0 ? (
              <div className="text-xs text-[var(--af-muted)]">No active maintenance work orders.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--af-surface-elevated)",
                      borderColor: "var(--af-border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "white"
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department allocations bar chart */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <Server className="h-4.5 w-4.5 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Allocations per Department</h3>
          </div>
          <div className="h-72 w-full">
            {departments.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">No departments defined.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptAllocCounts} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="name" stroke="var(--af-muted)" fontSize={10} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--af-surface-elevated)",
                      borderColor: "var(--af-border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "white"
                    }}
                  />
                  <Bar dataKey="allocated" name="Allocated Assets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
