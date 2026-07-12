"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import {
  AlertTriangle,
  FolderPlus,
  CalendarRange,
  Flame,
  FileCheck2,
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Box
} from "lucide-react";
import { Role } from "@assetflow/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
}


export default function DashboardPage() {
  // 1. Get logged-in user
  const { data: user } = useQuery<User>({
    queryKey: ["auth-user"],
  });

  // 2. Authoritative KPI counts (server-computed; not capped by pagination)
  const { data: kpis, isLoading: kpisLoading } = useQuery<any>({
    queryKey: ["dashboard-kpis"],
    queryFn: () => apiFetch<any>("/reports/dashboard"),
  });

  // 3. Fetch assets, active allocations & employees to build the overdue callout
  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=100"),
  });

  const { data: allocationsRes } = useQuery<{ data: any[] }>({
    queryKey: ["allocations"],
    queryFn: () => apiFetch<{ data: any[] }>("/allocations?status=active&pageSize=100"),
  });

  // 4. Fetch employees to resolve names for overdue allocations
  const { data: employeesRes } = useQuery<{ data: any[] }>({
    queryKey: ["employees"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/employees?pageSize=200"),
  });

  if (!user) return null;

  const assets = assetsRes?.data || [];
  const allocations = allocationsRes?.data || [];
  const employees = employeesRes?.data || [];

  // KPI numbers come from the server; fall back to 0 while loading
  const totalAssets = kpis?.totalAssets ?? 0;
  const availableAssets = kpis?.availableAssets ?? 0;
  const maintenanceAssets = kpis?.underMaintenanceAssets ?? 0;
  const activeBookings = kpis?.activeBookingsCount ?? 0;

  // Calculate Overdue Allocations: expectedReturnAt is past & returnedAt is null
  const now = new Date();
  const overdueAllocations = allocations.filter(al => {
    if (al.returnedAt || !al.expectedReturnAt) return false;
    // Filter by employee if user is Employee
    if (user.role === Role.Employee && al.employeeId !== user.id) return false;
    return new Date(al.expectedReturnAt) < now;
  }).map(al => {
    const asset = assets.find(a => a.id === al.assetId);
    const employee = user.role !== Role.Employee
      ? employees.find((u: any) => u.id === al.employeeId)
      : user;
    return {
      ...al,
      assetName: asset ? asset.name : "Asset",
      assetTag: asset ? asset.assetTag : "AF-XXXX",
      employeeName: employee ? employee.name : "Unknown Employee",
    };
  });

  // Fallback for static display if initialUsers is needed (or fetch from memory)
  // Let's define it inside mock data context

  // Quick actions config based on role
  const getQuickActions = () => {
    switch (user.role) {
      case Role.Admin:
      case Role.AssetManager:
        return [
          {
            title: "Register New Asset",
            desc: "Add standard hardware/software with auto-tagging",
            href: "/assets?action=new",
            icon: FolderPlus,
            color: "border-[var(--af-accent)]/30 hover:border-[var(--af-accent)]"
          },
          {
            title: "Audit Reconciliation",
            desc: "Perform scans or lock current audit cycles",
            href: "/audits",
            icon: FileCheck2,
            color: "border-emerald-500/20 hover:border-emerald-500"
          },
          {
            title: "Raise Maintenance Request",
            desc: "Log equipment faults and assign technicians",
            href: "/maintenance?action=new",
            icon: WrenchIcon,
            color: "border-orange-500/20 hover:border-orange-500"
          }
        ];
      case Role.DepartmentHead:
        return [
          {
            title: "Book Shared Resource",
            desc: "Reserve vehicles, screens, or conference devices",
            href: "/bookings",
            icon: CalendarRange,
            color: "border-[var(--af-accent)]/30 hover:border-[var(--af-accent)]"
          },
          {
            title: "Approve Transfers",
            desc: "Resolve employee asset movement requests",
            href: "/allocations?tab=transfers",
            icon: CheckCircle,
            color: "border-indigo-500/20 hover:border-indigo-500"
          },
          {
            title: "Report Asset Issue",
            desc: "Raise a support ticket for departmental assets",
            href: "/maintenance?action=new",
            icon: WrenchIcon,
            color: "border-orange-500/20 hover:border-orange-500"
          }
        ];
      case Role.Employee:
      default:
        return [
          {
            title: "Reserve Resource",
            desc: "Book available workspace resources & assets",
            href: "/bookings",
            icon: CalendarRange,
            color: "border-[var(--af-accent)]/30 hover:border-[var(--af-accent)]"
          },
          {
            title: "Transfer Request",
            desc: "Acquire an allocated asset from another team member",
            href: "/allocations?action=transfer",
            icon: Flame,
            color: "border-purple-500/20 hover:border-purple-500"
          },
          {
            title: "Report Issue",
            desc: "Open maintenance request for your allocated items",
            href: "/maintenance?action=new",
            icon: WrenchIcon,
            color: "border-orange-500/20 hover:border-orange-500"
          }
        ];
    }
  };

  const WrenchIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.65 2.65 0 0021 17.25l-5.83-5.83M11.42 15.17a3 3 0 11-4.24-4.24M11.42 15.17l-4.65-4.65M7.18 10.93L1.35 5.1A2.65 2.65 0 005.1 1.35l5.83 5.83M7.18 10.93l4.65 4.65M17 14.5a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Block */}
      <div className="relative overflow-hidden rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40 p-6 md:p-8">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-gradient-to-l from-[var(--af-accent)]/5 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--af-accent)] uppercase">AssetFlow Enterprise</span>
            <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold tracking-tight text-white">
              Hello, {user.name}
            </h2>
            <p className="text-sm text-[var(--af-muted)] max-w-xl">
              Here is your operations overview. You are logged in with <code className="text-[var(--af-accent)] font-mono">{user.role}</code> clearance level.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/assets"
              className="flex items-center gap-2 rounded-lg bg-[var(--af-surface-elevated)] border border-[var(--af-border)] px-4 py-2.5 text-xs text-white hover:bg-[var(--af-surface)] transition"
            >
              <span>View Directory</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--af-muted)]" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Asset Register", val: totalAssets, sub: "Items indexed", icon: Box, color: "text-white" },
          { label: "Available Stock", val: availableAssets, sub: "Ready for allocation", icon: CheckCircle, color: "text-[var(--af-success)]" },
          { label: "Under Maintenance", val: maintenanceAssets, sub: "In repair lifecycle", icon: Clock, color: "text-[var(--af-warning)]" },
          { label: "Active Bookings", val: activeBookings, sub: "Calendar reservations", icon: CalendarRange, color: "text-[var(--af-accent)]" }
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-5 transition-all hover:scale-[1.02] hover:bg-[var(--af-surface-elevated)]/50 group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider text-[var(--af-muted)] uppercase">{card.label}</span>
                <Icon className={`h-4.5 w-4.5 ${card.color} opacity-80 group-hover:opacity-100 transition`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-white font-[family-name:var(--font-display)]">
                  {kpisLoading ? "..." : card.val}
                </span>
                <span className="text-xs text-[var(--af-muted)]">{card.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overdue Allocations Callout */}
      {overdueAllocations.length > 0 && (
        <div className="rounded-[var(--af-radius)] border border-red-900/50 bg-red-950/20 p-5 relative overflow-hidden animate-pulse">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-500"></div>
          <div className="flex gap-4">
            <AlertTriangle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-3 flex-1">
              <div>
                <h4 className="font-semibold text-red-300 text-sm">Critical Attention Required: Overdue Allocations</h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {user.role === Role.Employee
                    ? "You have active assets whose expected return date has elapsed. Please check return policies."
                    : "The following employees have assets currently past due for collection or check-in."}
                </p>
              </div>
              <div className="divide-y divide-red-900/30 overflow-hidden rounded-lg border border-red-900/40 bg-black/40">
                {overdueAllocations.slice(0, 3).map((al) => (
                  <div key={al.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 text-xs gap-2">
                    <div className="space-y-0.5">
                      <span className="font-mono text-red-400 font-semibold">{al.assetTag}</span>
                      <span className="text-white ml-2 font-medium">{al.assetName}</span>
                      {user.role !== Role.Employee && (
                        <span className="text-[var(--af-muted)] ml-2">• Held by {al.employeeName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 font-medium">
                        Due {new Date(al.expectedReturnAt!).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/allocations?id=${al.id}`}
                        className="rounded bg-red-900/50 hover:bg-red-800/80 px-2.5 py-1 text-2xs text-white transition font-medium"
                      >
                        Action Return
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Strip */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[var(--af-accent)]" />
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-white">Recommended Actions</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {getQuickActions().map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link
                key={idx}
                href={action.href}
                className={`rounded-[var(--af-radius)] border bg-[var(--af-surface)]/70 p-5 transition-all hover:bg-[var(--af-surface-elevated)]/60 cursor-pointer block group ${action.color}`}
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-lg bg-[var(--af-surface-elevated)] p-2 group-hover:bg-[var(--af-accent)]/10 group-hover:text-[var(--af-accent)] transition">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-[var(--af-muted)] group-hover:text-white transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h4 className="mt-4 font-semibold text-white group-hover:text-[var(--af-accent)] transition text-sm">
                  {action.title}
                </h4>
                <p className="mt-1 text-xs text-[var(--af-muted)]">
                  {action.desc}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
