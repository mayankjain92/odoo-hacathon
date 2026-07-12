"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  BarChart3, TrendingUp, Download, PieChartIcon, Server, Activity,
  Wrench, Package, Users, AlertTriangle, Clock, CheckCircle
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#10b981"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] p-3 text-xs shadow-xl">
      {label && <p className="text-[var(--af-muted)] mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--af-muted)]">{p.name}:</span>
          <span className="text-white font-semibold">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const buildParams = () => {
    const params = new URLSearchParams();
    if (dateRange.from) params.set("from", dateRange.from);
    if (dateRange.to) params.set("to", dateRange.to);
    return params.toString() ? `?${params}` : "";
  };

  const qOpts = { retry: false };

  const { data: kpis, isLoading: kpisLoading } = useQuery<any>({
    queryKey: ["reports-dashboard"],
    queryFn: () => apiFetch<any>("/reports/dashboard"),
    ...qOpts,
  });

  const { data: statusDist, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["reports-asset-status", dateRange],
    queryFn: () => apiFetch<any>(`/reports/asset-status${buildParams()}`),
    ...qOpts,
  });

  const { data: utilData } = useQuery<any>({
    queryKey: ["reports-utilization", dateRange],
    queryFn: () => apiFetch<any>(`/reports/utilization${buildParams()}`),
    ...qOpts,
  });

  const { data: maintFreq } = useQuery<any>({
    queryKey: ["reports-maintenance-frequency", dateRange],
    queryFn: () => apiFetch<any>(`/reports/maintenance-frequency${buildParams()}`),
    ...qOpts,
  });

  const { data: deptSummary } = useQuery<any>({
    queryKey: ["reports-department-summary", dateRange],
    queryFn: () => apiFetch<any>(`/reports/department-summary${buildParams()}`),
    ...qOpts,
  });

  const { data: categoryReport } = useQuery<any>({
    queryKey: ["reports-categories"],
    queryFn: () => apiFetch<any>("/reports/categories"),
    ...qOpts,
  });

  const { data: allocTrend } = useQuery<any>({
    queryKey: ["reports-allocation-trend", dateRange],
    queryFn: () => apiFetch<any>(`/reports/allocation-trend${buildParams()}`),
    ...qOpts,
  });

  const { data: lifecycleAlerts } = useQuery<any>({
    queryKey: ["reports-lifecycle-alerts", dateRange],
    queryFn: () => apiFetch<any>(`/reports/lifecycle-alerts${buildParams()}`),
    ...qOpts,
  });

  const nearingRetirement = lifecycleAlerts?.nearingRetirement ?? [];
  const dueForMaintenance = lifecycleAlerts?.dueForMaintenance ?? [];

  // Build chart data
  const statusChartData = (statusDist?.distribution ?? []).map((d: any) => ({ name: d.status, value: d.count, pct: d.percentage }));
  const utilizationTopData = (utilData?.data ?? []).slice(0, 10).map((d: any) => ({ name: d.assetTag, utilization: d.utilizationPercent, hours: d.allocatedHours }));
  const maintPriorityData = Object.entries(maintFreq?.summary?.byPriority ?? {}).map(([name, value]) => ({ name, value: value as number }));
  const maintStatusData = Object.entries(maintFreq?.summary?.byStatus ?? {}).map(([name, value]) => ({ name, value: value as number }));
  const deptData = (deptSummary?.data ?? []).slice(0, 8).map((d: any) => ({ name: d.departmentName.slice(0, 12), assets: d.totalAssets, allocations: d.activeAllocations, overdue: d.overdueAllocations }));
  const categoryData = (categoryReport?.data ?? []).slice(0, 8).map((d: any) => ({ name: d.categoryName, count: d.totalAssets, cost: Math.round(d.totalAcquisitionCost) }));
  const allocTrendMonthly = Object.entries(allocTrend?.monthlyAllocations ?? {}).map(([month, count]) => ({ month, allocations: count as number }));

  const handleExportCsv = async (type: string) => {
    const params = buildParams();
    const token = typeof window !== "undefined" ? localStorage.getItem("af_access_token") : null;
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/reports/export/${type}${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token ?? ""}` } });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type}-report-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const KPICard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) => (
    <div className={`rounded-lg border p-4 space-y-2 border-${color}-500/20 bg-${color}-500/5`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 text-${color}-400`} />
        <p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-3xl font-bold text-${color}-400`}>{kpisLoading ? "—" : (value ?? "—")}</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Operational Analytics
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Live metrics, utilization trends, and exportable compliance reports.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["assets", "allocations", "bookings", "maintenance"].map(type => (
            <button key={type} onClick={() => handleExportCsv(type)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-2xs text-white hover:bg-[var(--af-surface)] transition cursor-pointer capitalize">
              <Download className="h-3 w-3 text-[var(--af-accent)]" /> {type}
            </button>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/40 p-4">
        <span className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Date Range:</span>
        <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
          className="rounded border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--af-accent)]" />
        <span className="text-[var(--af-muted)] text-xs">to</span>
        <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
          className="rounded border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--af-accent)]" />
        {(dateRange.from || dateRange.to) && (
          <button onClick={() => setDateRange({ from: "", to: "" })} className="text-xs text-[var(--af-accent)] hover:underline cursor-pointer">Clear</button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Package className="h-4 w-4 text-teal-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Total Assets</p></div>
          <p className="text-3xl font-bold text-teal-400">{kpisLoading ? "—" : kpis?.totalAssets ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-blue-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Utilization Rate</p></div>
          <p className="text-3xl font-bold text-blue-400">{kpisLoading ? "—" : `${kpis?.utilizationRate ?? 0}%`}</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Overdue Allocations</p></div>
          <p className="text-3xl font-bold text-amber-400">{kpisLoading ? "—" : kpis?.overdueAllocations ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Pending Maintenance</p></div>
          <p className="text-3xl font-bold text-orange-400">{kpisLoading ? "—" : kpis?.pendingMaintenance ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-violet-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Active Bookings</p></div>
          <p className="text-3xl font-bold text-violet-400">{kpisLoading ? "—" : kpis?.activeBookingsCount ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Available Assets</p></div>
          <p className="text-3xl font-bold text-emerald-400">{kpisLoading ? "—" : kpis?.availableAssets ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-rose-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Under Maintenance</p></div>
          <p className="text-3xl font-bold text-rose-400">{kpisLoading ? "—" : kpis?.underMaintenanceAssets ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-400" /><p className="text-2xs text-[var(--af-muted)] uppercase tracking-wider">Upcoming Returns</p></div>
          <p className="text-3xl font-bold text-sky-400">{kpisLoading ? "—" : kpis?.upcomingReturns ?? "—"}</p>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Asset Status Distribution (pie) */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Asset Status Distribution</h3>
          </div>
          <div className="h-64">
            {statusChartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                    {statusChartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Maintenance Priority breakdown */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Maintenance by Priority</h3>
          </div>
          <div className="h-64">
            {maintPriorityData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">No maintenance data for period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintPriorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="name" stroke="var(--af-muted)" fontSize={10} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Requests" radius={[4, 4, 0, 0]}>
                    {maintPriorityData.map((_: any, i: number) => <Cell key={i} fill={["#10b981", "#f59e0b", "#f97316", "#ef4444"][i] ?? COLORS[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Asset Utilization */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Top Asset Utilization (%) — Period</h3>
          </div>
          <div className="h-64">
            {utilizationTopData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">No utilization data. Try selecting a date range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationTopData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="name" stroke="var(--af-muted)" fontSize={9} angle={-30} textAnchor="end" interval={0} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="utilization" name="Utilization %" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department Summary */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Department Summary</h3>
          </div>
          <div className="h-64">
            {deptData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">No department data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="name" stroke="var(--af-muted)" fontSize={9} angle={-20} textAnchor="end" interval={0} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="assets" name="Total Assets" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="allocations" name="Active Allocations" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="overdue" name="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Assets by Category</h3>
          </div>
          <div className="h-64">
            {categoryData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} horizontal={false} />
                  <XAxis type="number" stroke="var(--af-muted)" fontSize={10} />
                  <YAxis dataKey="name" type="category" stroke="var(--af-muted)" fontSize={10} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Asset Count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Allocation Trend */}
        <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--af-accent)]" />
            <h3 className="font-semibold text-white text-sm">Allocation Trend (Monthly)</h3>
          </div>
          <div className="h-64">
            {allocTrendMonthly.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-[var(--af-muted)]">No allocation trend data. Set a date range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={allocTrendMonthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--af-border)" opacity={0.3} />
                  <XAxis dataKey="month" stroke="var(--af-muted)" fontSize={10} />
                  <YAxis stroke="var(--af-muted)" fontSize={10} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="allocations" name="Allocations" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Maintenance summary table */}
        {maintFreq?.summary?.topAssetsByFrequency?.length > 0 && (
          <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[var(--af-accent)]" />
              <h3 className="font-semibold text-white text-sm">Most Maintenance-Prone Assets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--af-border)] text-[var(--af-muted)] uppercase text-2xs">
                    <th className="py-2 pr-4">Asset Tag</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Total Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--af-border)]">
                  {maintFreq.summary.topAssetsByFrequency.slice(0, 8).map((a: any) => (
                    <tr key={a.assetId} className="hover:bg-[var(--af-surface)]/20">
                      <td className="py-2 pr-4 font-mono text-[var(--af-accent)]">{a.assetTag}</td>
                      <td className="py-2 pr-4 text-white">{a.name}</td>
                      <td className="py-2 pr-4 text-[var(--af-muted)]">{a.category ?? "—"}</td>
                      <td className="py-2 pr-4 font-bold text-rose-400">{a.totalRequests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Lifecycle Alerts: nearing retirement / due for maintenance */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Nearing Retirement</h3>
              <span className="ml-auto text-2xs text-[var(--af-muted)]">{nearingRetirement.length} assets</span>
            </div>
            {nearingRetirement.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--af-muted)]">No aging assets flagged.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--af-border)] text-[var(--af-muted)]">
                    <tr>
                      <th className="py-2 pr-4">Tag</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Age</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--af-border)]">
                    {nearingRetirement.slice(0, 8).map((a: any) => (
                      <tr key={a.assetId} className="hover:bg-[var(--af-surface)]/20">
                        <td className="py-2 pr-4 font-mono text-[var(--af-accent)]">{a.assetTag}</td>
                        <td className="py-2 pr-4 text-white">{a.name}</td>
                        <td className="py-2 pr-4 font-semibold text-amber-400">{a.ageYears}y</td>
                        <td className="py-2 pr-4 text-[var(--af-muted)]">{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Wrench className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-white">Due for Maintenance</h3>
              <span className="ml-auto text-2xs text-[var(--af-muted)]">{dueForMaintenance.length} assets</span>
            </div>
            {dueForMaintenance.length === 0 ? (
              <p className="py-6 text-center text-xs text-[var(--af-muted)]">No chronic-maintenance assets flagged.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--af-border)] text-[var(--af-muted)]">
                    <tr>
                      <th className="py-2 pr-4">Tag</th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Requests</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--af-border)]">
                    {dueForMaintenance.slice(0, 8).map((a: any) => (
                      <tr key={a.assetId} className="hover:bg-[var(--af-surface)]/20">
                        <td className="py-2 pr-4 font-mono text-[var(--af-accent)]">{a.assetTag}</td>
                        <td className="py-2 pr-4 text-white">{a.name}</td>
                        <td className="py-2 pr-4 font-bold text-rose-400">{a.maintenanceCount}</td>
                        <td className="py-2 pr-4 text-[var(--af-muted)]">{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
