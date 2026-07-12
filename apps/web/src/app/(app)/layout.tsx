"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Box,
  HandHelping,
  CalendarDays,
  Wrench,
  ShieldCheck,
  BarChart3,
  Bell,
  Network,
  LogOut,
  UserCheck,
  ChevronDown,
  Menu,
  X
} from "lucide-react";
import { Role } from "@assetflow/shared";

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/assets", label: "Assets", icon: Box, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/allocations", label: "Allocations", icon: HandHelping, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/bookings", label: "Bookings", icon: CalendarDays, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/maintenance", label: "Maintenance", icon: Wrench, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/audits", label: "Audits", icon: ShieldCheck, roles: [Role.Admin, Role.AssetManager] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/notifications", label: "Notifications & Log", icon: Bell, roles: [Role.Admin, Role.AssetManager, Role.DepartmentHead, Role.Employee] },
  { href: "/org", label: "Organization", icon: Network, roles: [Role.Admin] },
];

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Fetch current user session
  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["auth-user"],
    queryFn: () => apiFetch<User>("/auth/me"),
    retry: false,
  });

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (isError) {
      router.push("/login");
    }
  }, [isError, router]);

  // Fetch active notifications for badge
  const { data: notifications } = useQuery<{ data: any[] }>({
    queryKey: ["notifications", user?.id],
    queryFn: () => apiFetch<{ data: any[] }>("/notifications"),
    enabled: !!user,
  });

  const unreadCount = notifications?.data.filter(n => !n.read).length || 0;

  // Session swap mutation
  const swapMutation = useMutation({
    mutationFn: (userId: string) => apiFetch("/auth/session-swap", {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setDropdownOpen(false);
      router.refresh();
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    }
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1419]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2dd4bf] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) return null;

  // Guard routes based on roles
  const activeNavItem = navItems.find(item => item.href === pathname);
  const isAuthorized = activeNavItem ? activeNavItem.roles.includes(user.role) : true;

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-[#e8eef4]">
      {/* Sidebar for desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--af-border)] bg-[var(--af-surface)]/90 backdrop-blur-md p-5 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:static md:flex md:flex-col shrink-0`}>
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--af-accent)] hover:opacity-90"
          >
            AssetFlow
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="text-[var(--af-muted)] md:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 flex-1 flex flex-col gap-1.5 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.roles.includes(user.role)) return null;
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? "bg-[var(--af-accent)]/15 text-[var(--af-accent)] border-l-2 border-[var(--af-accent)]"
                    : "text-[var(--af-muted)] hover:bg-[var(--af-surface-elevated)] hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--af-accent)] px-2 py-0.5 text-2xs font-bold text-[#042f2e]">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="mt-auto border-t border-[var(--af-border)] pt-4 space-y-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{user.name}</span>
            <span className="text-xs text-[var(--af-muted)] font-mono">{user.role}</span>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-950/20 hover:text-red-300 transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-[var(--af-border)] bg-[var(--af-surface)]/60 px-6 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--af-muted)] md:hidden">
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="hidden font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-white sm:block">
              {activeNavItem?.label || "AssetFlow Workspace"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Role-Switcher dropdown for hackathon testing */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3.5 py-1.5 text-xs text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
              >
                <UserCheck className="h-4 w-4 text-[var(--af-accent)]" />
                <span className="font-mono">Demo Role: {user.role}</span>
                <ChevronDown className="h-3 w-3" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] p-1.5 shadow-xl animate-in fade-in-50 slide-in-from-top-2">
                  <div className="px-2 py-1 text-2xs uppercase tracking-wider text-[var(--af-muted)] font-semibold border-b border-[var(--af-border)] mb-1">
                    Select Demo Account
                  </div>
                  <button
                    onClick={() => swapMutation.mutate("usr-1")}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-[var(--af-surface)] transition cursor-pointer text-white"
                  >
                    <span>Alice Admin</span>
                    <span className="font-mono text-2xs text-[var(--af-accent)]">Admin</span>
                  </button>
                  <button
                    onClick={() => swapMutation.mutate("usr-2")}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-[var(--af-surface)] transition cursor-pointer text-white"
                  >
                    <span>Manny Manager</span>
                    <span className="font-mono text-2xs text-[var(--af-accent)]">AssetManager</span>
                  </button>
                  <button
                    onClick={() => swapMutation.mutate("usr-3")}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-[var(--af-surface)] transition cursor-pointer text-white"
                  >
                    <span>Harvey Head</span>
                    <span className="font-mono text-2xs text-[var(--af-accent)]">DeptHead</span>
                  </button>
                  <button
                    onClick={() => swapMutation.mutate("usr-4")}
                    className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-[var(--af-surface)] transition cursor-pointer text-white"
                  >
                    <span>Emily Employee</span>
                    <span className="font-mono text-2xs text-[var(--af-accent)]">Employee</span>
                  </button>
                </div>
              )}
            </div>

            <Link href="/notifications" className="relative text-[var(--af-muted)] hover:text-white transition">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--af-accent)] text-3xs font-extrabold text-[#042f2e] flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Content Guard */}
        <main className="flex-1 p-6 overflow-y-auto">
          {isAuthorized ? (
            children
          ) : (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
              <div className="rounded-full bg-red-950/30 border border-red-900/60 p-4 text-red-400">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
                Access Restricted
              </h2>
              <p className="max-w-md text-[var(--af-muted)] text-sm">
                Your account ({user.name}) with role <code className="font-mono text-red-400">{user.role}</code> does not have authorization to view this workspace section.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-lg bg-[var(--af-surface-elevated)] border border-[var(--af-border)] px-4 py-2 text-sm text-white hover:bg-[var(--af-surface)] transition"
              >
                Return to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
