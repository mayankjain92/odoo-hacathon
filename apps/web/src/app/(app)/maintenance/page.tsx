"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMaintenanceSchema, MaintenanceStatus, MaintenancePriority, Role } from "@assetflow/shared";
import {
  Plus,
  X,
  Wrench,
  CheckCircle,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  ChevronRight,
  ThumbsDown,
  UserCheck,
  PlayCircle,
  Shield
} from "lucide-react";
import { useSearchParams } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MaintenanceRequest {
  id: string;
  assetId: string;
  requesterId: string;
  description: string;
  priority: string;
  status: string;
  photoUrl?: string | null;
  technician?: string | null;
  createdAt: string;
  updatedAt: string;
  asset: { id: string; name: string; assetTag: string; status: string };
  requester: { id: string; name: string; email: string };
}

// ─── Status pipeline config ───────────────────────────────────────────────────
const PIPELINE_COLUMNS = [
  {
    key: MaintenanceStatus.Pending,
    label: "Pending",
    icon: Clock,
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    badge: "bg-amber-950/60 text-amber-400 border-amber-800/60",
  },
  {
    key: MaintenanceStatus.Approved,
    label: "Approved",
    icon: CheckCircle,
    color: "text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    badge: "bg-sky-950/60 text-sky-400 border-sky-800/60",
  },
  {
    key: MaintenanceStatus.TechnicianAssigned,
    label: "Technician Assigned",
    icon: UserCheck,
    color: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    badge: "bg-violet-950/60 text-violet-400 border-violet-800/60",
  },
  {
    key: MaintenanceStatus.InProgress,
    label: "In Progress",
    icon: PlayCircle,
    color: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    badge: "bg-orange-950/60 text-orange-400 border-orange-800/60",
  },
  {
    key: MaintenanceStatus.Resolved,
    label: "Resolved",
    icon: Shield,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    badge: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60",
  },
  {
    key: MaintenanceStatus.Rejected,
    label: "Rejected",
    icon: XCircle,
    color: "text-rose-400",
    border: "border-rose-500/30",
    bg: "bg-rose-500/5",
    badge: "bg-rose-950/60 text-rose-400 border-rose-800/60",
  },
];

const PRIORITY_BADGE: Record<string, string> = {
  Critical: "bg-rose-950/60 text-rose-400 border border-rose-800/60",
  High: "bg-orange-950/60 text-orange-400 border border-orange-800/60",
  Medium: "bg-amber-950/60 text-amber-400 border border-amber-800/60",
  Low: "bg-neutral-900/60 text-neutral-400 border border-neutral-800",
};

// Allowed next statuses per current status (mirrors the backend ALLOWED_TRANSITIONS)
const NEXT_ACTIONS: Record<string, { label: string; status: string; color: string }[]> = {
  [MaintenanceStatus.Pending]: [
    { label: "Approve", status: MaintenanceStatus.Approved, color: "bg-sky-950 border-sky-800 text-sky-400 hover:bg-sky-900/60" },
    { label: "Reject", status: MaintenanceStatus.Rejected, color: "bg-rose-950/20 border-rose-900/40 text-rose-400 hover:bg-rose-950/50" },
  ],
  [MaintenanceStatus.Approved]: [
    { label: "Assign Technician", status: MaintenanceStatus.TechnicianAssigned, color: "bg-violet-950 border-violet-800 text-violet-400 hover:bg-violet-900/60" },
    { label: "Start Repair", status: MaintenanceStatus.InProgress, color: "bg-orange-950 border-orange-800 text-orange-400 hover:bg-orange-900/60" },
    { label: "Mark Resolved", status: MaintenanceStatus.Resolved, color: "bg-emerald-950 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60" },
  ],
  [MaintenanceStatus.TechnicianAssigned]: [
    { label: "Start Repair", status: MaintenanceStatus.InProgress, color: "bg-orange-950 border-orange-800 text-orange-400 hover:bg-orange-900/60" },
    { label: "Mark Resolved", status: MaintenanceStatus.Resolved, color: "bg-emerald-950 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60" },
  ],
  [MaintenanceStatus.InProgress]: [
    { label: "Mark Resolved", status: MaintenanceStatus.Resolved, color: "bg-emerald-950 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60" },
  ],
};

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [showReqDrawer, setShowReqDrawer] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<{
    request: MaintenanceRequest;
    nextStatus: string;
  } | null>(null);
  const [technicianName, setTechnicianName] = useState("");

  // Trigger drawer from query params (e.g. from Dashboard quick action)
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowReqDrawer(true);
    }
  }, [searchParams]);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=200"),
  });
  const assets = assetsRes?.data || [];

  const { data: maintenanceRes, isLoading } = useQuery<{
    data: MaintenanceRequest[];
    meta: any;
  }>({
    queryKey: ["maintenance"],
    queryFn: () => apiFetch<{ data: MaintenanceRequest[]; meta: any }>("/maintenance?pageSize=200"),
  });
  const maintenance = maintenanceRes?.data || [];

  // ─── Form ──────────────────────────────────────────────────────────────────
  const {
    register: registerReq,
    handleSubmit: handleSubmitReq,
    reset: resetReq,
    formState: { errors: reqErrors },
  } = useForm({
    resolver: zodResolver(createMaintenanceSchema),
    defaultValues: { assetId: "", description: "", priority: "Medium" as const },
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createRequestMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/maintenance", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      resetReq();
      setShowReqDrawer(false);
    },
  });

  // Single unified mutation for all status transitions: PUT /maintenance/:id/resolve
  const transitionMutation = useMutation({
    mutationFn: ({ id, status, technician }: { id: string; status: string; technician?: string }) =>
      apiFetch(`/maintenance/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ status, ...(technician ? { technician } : {}) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
      setTransitionTarget(null);
      setTechnicianName("");
    },
  });

  const handleTransitionClick = (request: MaintenanceRequest, nextStatus: string) => {
    if (nextStatus === MaintenanceStatus.TechnicianAssigned) {
      // Need technician name — open modal
      setTransitionTarget({ request, nextStatus });
    } else if (nextStatus === MaintenanceStatus.Resolved) {
      // Resolved also benefits from a notes modal
      setTransitionTarget({ request, nextStatus });
    } else {
      // Direct transition (Approve, Reject, InProgress)
      transitionMutation.mutate({ id: request.id, status: nextStatus });
    }
  };

  const isOperator = user?.role === Role.Admin || user?.role === Role.AssetManager;

  // ─── Summary counts ────────────────────────────────────────────────────────
  const pendingCount = maintenance.filter(m => m.status === MaintenanceStatus.Pending).length;
  const inProgressCount = maintenance.filter(m =>
    [MaintenanceStatus.Approved, MaintenanceStatus.TechnicianAssigned, MaintenanceStatus.InProgress].includes(m.status as any)
  ).length;
  const resolvedCount = maintenance.filter(m => m.status === MaintenanceStatus.Resolved).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Maintenance Pipeline
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Track and manage equipment maintenance requests through the approval and repair lifecycle.
          </p>
        </div>

        <button
          onClick={() => setShowReqDrawer(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4 py-2.5 text-xs font-semibold transition cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Raise Ticket
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs text-[var(--af-muted)] uppercase tracking-wider">Pending Review</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="text-xs text-[var(--af-muted)] uppercase tracking-wider">In Progress</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">{inProgressCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs text-[var(--af-muted)] uppercase tracking-wider">Resolved</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[var(--af-muted)] text-sm">
          Loading maintenance requests...
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 items-start">
          {PIPELINE_COLUMNS.map((col) => {
            const tickets = maintenance.filter((t) => t.status === col.key);
            const ColIcon = col.icon;

            return (
              <div
                key={col.key}
                className={`rounded-lg border ${col.border} ${col.bg} p-4 space-y-3 min-h-[320px] flex flex-col`}
              >
                {/* Column header */}
                <div className="flex justify-between items-center border-b border-[var(--af-border)] pb-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <ColIcon className={`h-3.5 w-3.5 ${col.color}`} />
                    <span className={`font-semibold text-xs uppercase tracking-wider ${col.color}`}>
                      {col.label}
                    </span>
                  </div>
                  <span className="rounded bg-[var(--af-surface-elevated)] px-2 py-0.5 text-2xs font-mono font-semibold text-white border border-[var(--af-border)]">
                    {tickets.length}
                  </span>
                </div>

                {/* Tickets */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {tickets.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-8 text-3xs text-[var(--af-muted)]">
                      No tickets
                    </div>
                  ) : (
                    tickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-3.5 space-y-2.5 shadow-md hover:border-neutral-600 transition"
                      >
                        {/* Asset tag + priority */}
                        <div className="flex justify-between items-start">
                          <span className="font-mono text-3xs text-[var(--af-accent)] font-semibold">
                            {t.asset?.assetTag ?? "—"}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-3xs font-semibold uppercase ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.Low}`}>
                            {t.priority}
                          </span>
                        </div>

                        {/* Asset name */}
                        <h4 className="text-white font-semibold text-xs leading-normal">
                          {t.asset?.name ?? "Unknown Asset"}
                        </h4>
                        <p className="text-3xs text-[var(--af-muted)] leading-relaxed line-clamp-2">
                          {t.description}
                        </p>

                        {/* Technician info */}
                        {t.technician && (
                          <div className="flex items-center gap-1 text-3xs text-violet-400">
                            <User className="h-3 w-3" />
                            <span>{t.technician}</span>
                          </div>
                        )}

                        {/* Requester + date */}
                        <div className="text-3xs text-[var(--af-muted)] flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {t.requester?.name ?? "Unknown"} · {new Date(t.createdAt).toLocaleDateString()}
                        </div>

                        {/* Operator transition actions */}
                        {isOperator && NEXT_ACTIONS[t.status] && (
                          <div className="border-t border-[var(--af-border)] pt-2.5 flex flex-wrap gap-1.5">
                            {NEXT_ACTIONS[t.status].map((action) => (
                              <button
                                key={action.status}
                                onClick={() => handleTransitionClick(t, action.status)}
                                disabled={transitionMutation.isPending}
                                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-3xs font-semibold transition cursor-pointer disabled:opacity-50 ${action.color}`}
                              >
                                <ChevronRight className="h-2.5 w-2.5" />
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Raise Request Drawer ── */}
      {showReqDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--af-surface)] border-l border-[var(--af-border)] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-6 pr-1 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-[var(--af-accent)]" />
                Raise Maintenance Ticket
              </h3>
              <button
                onClick={() => setShowReqDrawer(false)}
                className="text-[var(--af-muted)] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createRequestMutation.isError && (
              <div className="rounded-md border border-red-800/60 bg-red-950/30 p-3 text-xs text-red-400">
                Failed to submit ticket. Please try again.
              </div>
            )}

            <form
              id="req-form"
              onSubmit={handleSubmitReq((data) => createRequestMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">
                  Target Asset
                </label>
                <select
                  {...registerReq("assetId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Select Faulty Asset</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.assetTag}) — {a.status}
                    </option>
                  ))}
                </select>
                {reqErrors.assetId && (
                  <p className="text-3xs text-red-400">{reqErrors.assetId.message as string}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">
                  Description
                </label>
                <textarea
                  {...registerReq("description")}
                  placeholder="Describe the issue in detail..."
                  rows={4}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)] resize-none"
                />
                {reqErrors.description && (
                  <p className="text-3xs text-red-400">{reqErrors.description.message as string}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">
                  Priority Level
                </label>
                <select
                  {...registerReq("priority")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value={MaintenancePriority.Low}>Low</option>
                  <option value={MaintenancePriority.Medium}>Medium</option>
                  <option value={MaintenancePriority.High}>High</option>
                  <option value={MaintenancePriority.Critical}>Critical</option>
                </select>
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="req-form"
            disabled={createRequestMutation.isPending}
            className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-3 text-xs font-semibold transition disabled:opacity-50 mt-4 cursor-pointer"
          >
            {createRequestMutation.isPending ? "Submitting..." : "File Ticket"}
          </button>
        </div>
      )}

      {/* ── Transition Modal (Technician Assigned / Resolved) ── */}
      {transitionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                {transitionTarget.nextStatus === MaintenanceStatus.TechnicianAssigned && (
                  <UserCheck className="h-4 w-4 text-violet-400" />
                )}
                {transitionTarget.nextStatus === MaintenanceStatus.Resolved && (
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                )}
                {transitionTarget.nextStatus === MaintenanceStatus.TechnicianAssigned
                  ? "Assign Technician"
                  : "Resolve Ticket"}
              </h4>
              <button
                onClick={() => { setTransitionTarget(null); setTechnicianName(""); }}
                className="text-[var(--af-muted)] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--af-muted)]">
              Asset: <strong className="text-white">{transitionTarget.request.asset?.name}</strong>{" "}
              ({transitionTarget.request.asset?.assetTag})
            </p>

            {transitionTarget.nextStatus === MaintenanceStatus.TechnicianAssigned && (
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">
                  Technician Name
                </label>
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                />
              </div>
            )}

            {transitionTarget.nextStatus === MaintenanceStatus.Resolved && (
              <div className="rounded-md border border-emerald-800/40 bg-emerald-950/20 p-3 text-xs text-emerald-300">
                This will mark the ticket as resolved and restore the asset status to Available.
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setTransitionTarget(null); setTechnicianName(""); }}
                className="flex-1 rounded-md border border-[var(--af-border)] py-2.5 text-xs font-semibold text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  transitionMutation.mutate({
                    id: transitionTarget.request.id,
                    status: transitionTarget.nextStatus,
                    technician: technicianName || undefined,
                  });
                }}
                disabled={
                  transitionMutation.isPending ||
                  (transitionTarget.nextStatus === MaintenanceStatus.TechnicianAssigned && !technicianName.trim())
                }
                className="flex-1 rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {transitionMutation.isPending ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
