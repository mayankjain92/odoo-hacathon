"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldCheck,
  Plus,
  X,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Lock,
  Search,
  Eye,
  RefreshCw,
  FolderLock
} from "lucide-react";
import { Role } from "@assetflow/shared";

const createAuditCycleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  scopeCategoryId: z.string().optional(),
  auditorId: z.string().min(1, "Auditor is required"),
  dueAt: z.string().min(1, "Due date is required"),
});

export default function AuditsPage() {
  const queryClient = useQueryClient();

  // Panels & UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeConsoleCycle, setActiveConsoleCycle] = useState<any | null>(null);

  // Queries
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: deptsRes } = useQuery<{ data: any[] }>({
    queryKey: ["departments"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/departments"),
  });
  const departments = deptsRes?.data || [];

  const { data: catsRes } = useQuery<{ data: any[] }>({
    queryKey: ["categories"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/categories"),
  });
  const categories = catsRes?.data || [];

  const { data: employeesRes } = useQuery<any>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/org/employees"),
  });
  const employees = employeesRes?.data || [];

  const { data: auditsRes, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["audits"],
    queryFn: () => apiFetch<{ data: any[] }>("/audits"),
  });
  const audits = auditsRes?.data || [];

  // Form for New Audit Cycle
  const {
    register: registerAudit,
    handleSubmit: handleSubmitAudit,
    reset: resetAudit,
    formState: { errors: auditErrors },
  } = useForm({
    resolver: zodResolver(createAuditCycleSchema),
    defaultValues: {
      name: "",
      scopeCategoryId: "",
      auditorId: "",
      dueAt: "",
    },
  });

  // Create Cycle mutation
  const createAuditMutation = useMutation({
    mutationFn: (data: any) => {
      return apiFetch("/audits", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          scopeCategoryId: data.scopeCategoryId || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      resetAudit();
      setShowCreateForm(false);
    },
  });

  // Verify Audit Item mutation
  const verifyItemMutation = useMutation({
    mutationFn: ({ cycleId, itemId, status }: { cycleId: string; itemId: string; status: "Found" | "Missing" }) => {
      return apiFetch(`/audits/${cycleId}/items/${itemId}/verify`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      // Update local active console state to match the fresh list
      if (activeConsoleCycle) {
        apiFetch<any>(`/audits`).then((res) => {
          const freshCycle = res.data.find((c: any) => c.id === variables.cycleId);
          if (freshCycle) {
            setActiveConsoleCycle(freshCycle);
          }
        });
      }
    },
  });

  // Close/Lock Audit Cycle mutation
  const closeCycleMutation = useMutation({
    mutationFn: (cycleId: string) => {
      return apiFetch(`/audits/${cycleId}/close`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setActiveConsoleCycle(null);
    },
  });

  const isEditor = user?.role === Role.Admin || user?.role === Role.AssetManager;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Asset Verification Audits
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Schedule compliance checks, reconcile hardware, and resolve missing inventory discrepancies.
          </p>
        </div>

        {isEditor && !activeConsoleCycle && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2.5 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Schedule Audit Cycle
          </button>
        )}
      </div>

      {/* Auditor Console view takes full page priority if active */}
      {activeConsoleCycle ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--af-surface)]/60 border border-[var(--af-border)] rounded-lg p-5 gap-4">
            <div className="space-y-1">
              <span className="text-3xs uppercase tracking-wider text-[var(--af-accent)] font-semibold font-mono">
                Verification Workspace
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white">
                {activeConsoleCycle.name}
              </h3>
              <p className="text-2xs text-[var(--af-muted)]">
                Assigned Auditor: <strong className="text-neutral-300">
                  {employees.find((e: any) => e.id === activeConsoleCycle.auditorId)?.name || "Auditor"}
                </strong> • Scope: <strong className="text-neutral-300">
                  {activeConsoleCycle.scopeCategoryId
                    ? categories.find((c: any) => c.id === activeConsoleCycle.scopeCategoryId)?.name
                    : "All Categories"}
                </strong>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setActiveConsoleCycle(null)}
                className="rounded-lg border border-[var(--af-border)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
              >
                Exit Console
              </button>

              {activeConsoleCycle.status === "Active" && (
                <button
                  onClick={() => closeCycleMutation.mutate(activeConsoleCycle.id)}
                  disabled={closeCycleMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4.5 py-2 text-xs font-semibold transition cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  Lock & Close Cycle
                </button>
              )}
            </div>
          </div>

          {/* Audit Verification Table */}
          <div className="overflow-x-auto rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40">
            <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
              <thead>
                <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Asset Tag</th>
                  <th className="px-6 py-4">Asset Name</th>
                  <th className="px-6 py-4">Expected Holder</th>
                  <th className="px-6 py-4">Verification Status</th>
                  <th className="px-6 py-4">Reconciled At</th>
                  <th className="px-6 py-4 text-right">Verification Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--af-border)] bg-transparent">
                {activeConsoleCycle.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[var(--af-muted)]">
                      No assets found matching the audit scope.
                    </td>
                  </tr>
                ) : (
                  activeConsoleCycle.items.map((item: any) => {
                    const emp = employees.find((e: any) => e.id === item.expectedHolderId);

                    return (
                      <tr key={item.id} className="hover:bg-[var(--af-surface)]/20 transition">
                        <td className="px-6 py-4 font-mono font-semibold text-[var(--af-accent)]">
                          {item.assetTag}
                        </td>
                        <td className="px-6 py-4 font-medium text-white">{item.assetName}</td>
                        <td className="px-6 py-4">{emp ? emp.name : "Storage/Available"}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${
                            item.verificationStatus === "Found" ? "text-emerald-400" :
                            item.verificationStatus === "Missing" ? "text-rose-400 font-bold" : "text-amber-400"
                          }`}>
                            {item.verificationStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[var(--af-muted)]">
                          {item.verifiedAt ? new Date(item.verifiedAt).toLocaleString() : "Pending Scan"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {activeConsoleCycle.status === "Active" && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => verifyItemMutation.mutate({
                                  cycleId: activeConsoleCycle.id,
                                  itemId: item.id,
                                  status: "Found"
                                })}
                                disabled={verifyItemMutation.isPending}
                                className={`rounded px-2.5 py-1 text-2xs font-semibold transition cursor-pointer ${
                                  item.verificationStatus === "Found"
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                    : "border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 text-neutral-300 hover:text-white"
                                }`}
                              >
                                Match Found
                              </button>
                              <button
                                onClick={() => verifyItemMutation.mutate({
                                  cycleId: activeConsoleCycle.id,
                                  itemId: item.id,
                                  status: "Missing"
                                })}
                                disabled={verifyItemMutation.isPending}
                                className={`rounded px-2.5 py-1 text-2xs font-semibold transition cursor-pointer ${
                                  item.verificationStatus === "Missing"
                                    ? "bg-rose-950 text-rose-400 border border-rose-800"
                                    : "border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 text-neutral-300 hover:text-white"
                                }`}
                              >
                                Flag Missing
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Discrepancy report summary card */}
          {activeConsoleCycle.status === "Completed" && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-5 space-y-3">
              <h4 className="font-semibold text-red-300 text-sm flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Audit Discrepancy Report Summary
              </h4>
              <p className="text-xs text-neutral-400">
                This cycle is closed and locked. Assets marked as <strong className="text-rose-400">Missing</strong> have automatically had their inventory lifecycle statuses transitioned to <strong className="text-red-400 font-mono">Lost</strong>.
              </p>
              <div className="text-xs space-y-1 bg-black/45 border border-red-900/30 rounded p-3 font-mono text-[var(--af-muted)]">
                <div>Total Scope Count: {activeConsoleCycle.items.length}</div>
                <div>Matches Verified: {activeConsoleCycle.items.filter((i: any) => i.verificationStatus === "Found").length}</div>
                <div>Flagged Lost: <span className="text-rose-400 font-bold">{activeConsoleCycle.items.filter((i: any) => i.verificationStatus === "Missing").length}</span></div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regular list layout of audit cycles */
        <div className="grid gap-6 md:grid-cols-3 items-start">
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider text-[var(--af-muted)]">
              Scheduled Cycle Log
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {audits.map((cycle: any) => {
                const aud = employees.find((e: any) => e.id === cycle.auditorId);
                const scope = cycle.scopeCategoryId ? categories.find((c: any) => c.id === cycle.scopeCategoryId)?.name : "All Inventory";

                return (
                  <div
                    key={cycle.id}
                    className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{cycle.name}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                        cycle.status === "Completed" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" :
                        cycle.status === "Active" ? "bg-amber-950 text-amber-400 border border-amber-800/40 animate-pulse" :
                        "bg-neutral-900 text-neutral-400 border border-neutral-800"
                      }`}>
                        {cycle.status}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-[var(--af-muted)]">
                      <div>Scope: <strong className="text-neutral-300">{scope}</strong></div>
                      <div>Auditor: <strong className="text-neutral-300">{aud ? aud.name : "Unassigned"}</strong></div>
                      <div>Due date: <strong className="text-neutral-300">{new Date(cycle.dueAt).toLocaleDateString()}</strong></div>
                    </div>

                    <div className="border-t border-[var(--af-border)] pt-3.5 flex justify-end">
                      <button
                        onClick={() => setActiveConsoleCycle(cycle)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3.5 py-1.5 text-2xs text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {cycle.status === "Completed" ? "View Report" : "Auditor Console"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Cycle Form Card */}
          {showCreateForm && (
            <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
                <h4 className="font-semibold text-white text-sm">Schedule Audit</h4>
                <button onClick={() => setShowCreateForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitAudit((data) => createAuditMutation.mutate(data))} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Cycle Name</label>
                  <input
                    type="text"
                    {...registerAudit("name")}
                    placeholder="Q3 Hardware Audit..."
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                  />
                  {auditErrors.name && <p className="text-3xs text-red-400">{auditErrors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Audit Scope Category</label>
                  <select
                    {...registerAudit("scopeCategoryId")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Designated Auditor</label>
                  <select
                    {...registerAudit("auditorId")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  >
                    <option value="">Select Auditor</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                  {auditErrors.auditorId && <p className="text-3xs text-red-400">{auditErrors.auditorId.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Due Date</label>
                  <input
                    type="date"
                    {...registerAudit("dueAt")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  />
                  {auditErrors.dueAt && <p className="text-3xs text-red-400">{auditErrors.dueAt.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={createAuditMutation.isPending}
                  className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2.5 text-xs font-semibold transition disabled:opacity-50"
                >
                  Confirm Schedule
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
