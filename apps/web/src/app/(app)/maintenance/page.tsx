"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createMaintenanceSchema, Role } from "@assetflow/shared";
import {
  Plus,
  X,
  Wrench,
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  User,
  MoreVertical,
  Activity
} from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Modals & Drawers State
  const [showReqDrawer, setShowReqDrawer] = useState(false);
  const [resolvingRequest, setResolvingRequest] = useState<any | null>(null);

  // Trigger drawer from query params (e.g. from Dashboard quick action)
  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowReqDrawer(true);
    }
  }, [searchParams]);

  // Queries
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=100"),
  });
  const assets = assetsRes?.data || [];

  const { data: maintenanceRes, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["maintenance"],
    queryFn: () => apiFetch<{ data: any[] }>("/maintenance"),
  });
  const maintenance = maintenanceRes?.data || [];

  // Form for New Maintenance Request
  const {
    register: registerReq,
    handleSubmit: handleSubmitReq,
    reset: resetReq,
    formState: { errors: reqErrors },
  } = useForm({
    resolver: zodResolver(createMaintenanceSchema),
    defaultValues: {
      assetId: "",
      description: "",
      priority: "Medium" as const,
    },
  });

  // Mutation to Create Ticket
  const createRequestMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/maintenance", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      resetReq();
      setShowReqDrawer(false);
    },
  });

  // Pipeline transitions mutations
  const startRepairMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/maintenance/${id}/start`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const resolveRepairMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => {
      return apiFetch(`/maintenance/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolutionNotes: notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setResolvingRequest(null);
    },
  });

  const cancelRepairMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/maintenance/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  // Columns Configuration
  const statuses = [
    { key: "Reported", label: "Reported Tickets", color: "bg-red-500/10 border-red-500/30 text-red-400" },
    { key: "In_Progress", label: "In Progress", color: "bg-amber-500/10 border-amber-500/30 text-amber-400" },
    { key: "Resolved", label: "Resolved", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
    { key: "Cancelled", label: "Cancelled", color: "bg-neutral-500/10 border-neutral-500/30 text-neutral-400" },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-rose-950/60 text-rose-400 border border-rose-800/60";
      case "High":
        return "bg-orange-950/60 text-orange-400 border border-orange-800/60";
      case "Medium":
        return "bg-amber-950/60 text-amber-400 border border-amber-800/60";
      case "Low":
      default:
        return "bg-neutral-900/60 text-neutral-400 border border-neutral-800";
    }
  };

  const isOperator = user?.role === Role.Admin || user?.role === Role.AssetManager;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Maintenance Pipeline
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Monitor reported equipment hardware breakdowns and log repair notes.
          </p>
        </div>

        <button
          onClick={() => setShowReqDrawer(true)}
          className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2.5 text-xs font-semibold transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Raise Maintenance Ticket
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="grid gap-4 md:grid-cols-4 items-start overflow-x-auto min-w-[768px] md:min-w-0">
        {statuses.map((col) => {
          const tickets = maintenance.filter(t => t.status === col.key);

          return (
            <div
              key={col.key}
              className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/20 p-4 space-y-4 min-h-[450px] flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-[var(--af-border)] pb-3 shrink-0">
                <span className="font-semibold text-white text-xs uppercase tracking-wider">{col.label}</span>
                <span className="rounded bg-[var(--af-surface-elevated)] px-2 py-0.5 text-2xs font-mono font-semibold text-white border border-[var(--af-border)]">
                  {tickets.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {tickets.map((t: any) => {
                  const asset = assets.find(a => a.id === t.assetId);

                  return (
                    <div
                      key={t.id}
                      className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/80 p-4 space-y-3 shadow-md hover:border-neutral-700 transition"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-3xs text-[var(--af-accent)] font-semibold">
                          {asset ? asset.assetTag : "AF-XXXX"}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-3xs font-semibold uppercase ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>

                      <h4 className="text-white font-semibold text-xs leading-normal">
                        {asset ? asset.name : "Asset Issue"}
                      </h4>
                      <p className="text-3xs text-[var(--af-muted)] leading-relaxed line-clamp-2">{t.description}</p>

                      {t.resolutionNotes && (
                        <div className="rounded bg-[var(--af-surface-elevated)]/60 border border-[var(--af-border)]/50 p-2.5 text-3xs text-[var(--af-muted)] space-y-0.5">
                          <span className="font-bold text-white uppercase block tracking-wider">Resolution notes:</span>
                          <p>{t.resolutionNotes}</p>
                        </div>
                      )}

                      {/* Action trigger button triggers if user has clearance */}
                      {isOperator && (
                        <div className="border-t border-[var(--af-border)] pt-2.5 flex justify-end gap-1.5">
                          {t.status === "Reported" && (
                            <>
                              <button
                                onClick={() => startRepairMutation.mutate(t.id)}
                                className="inline-flex items-center gap-1 rounded bg-[var(--af-surface-elevated)] border border-[var(--af-border)] px-2.5 py-1 text-3xs font-semibold text-white hover:bg-[var(--af-surface)] transition cursor-pointer"
                              >
                                <Play className="h-3 w-3 text-amber-400" /> Start
                              </button>
                              <button
                                onClick={() => cancelRepairMutation.mutate(t.id)}
                                className="inline-flex items-center gap-1 rounded bg-red-950/20 border border-red-900/40 px-2.5 py-1 text-3xs font-semibold text-red-400 hover:bg-red-950/50 transition cursor-pointer"
                              >
                                <XCircle className="h-3 w-3" /> Skip
                              </button>
                            </>
                          )}
                          {t.status === "In_Progress" && (
                            <button
                              onClick={() => setResolvingRequest(t)}
                              className="inline-flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 px-2.5 py-1 text-3xs font-semibold hover:bg-emerald-900/60 transition cursor-pointer"
                            >
                              <CheckCircle className="h-3 w-3" /> Resolve
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Raise Request Drawer */}
      {showReqDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--af-surface)] border-l border-[var(--af-border)] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-6 pr-1 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <Wrench className="h-5 w-5 text-[var(--af-accent)]" />
                Raise Maintenance Ticket
              </h3>
              <button onClick={() => setShowReqDrawer(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="req-form" onSubmit={handleSubmitReq((data) => createRequestMutation.mutate(data))} className="space-y-4">
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Target Asset</label>
                <select
                  {...registerReq("assetId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Select Faulty Asset</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.assetTag}) - {a.status}</option>
                  ))}
                </select>
                {reqErrors.assetId && <p className="text-3xs text-red-400">{reqErrors.assetId.message}</p>}
              </div>



              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Description</label>
                <textarea
                  {...registerReq("description")}
                  placeholder="Elaborate details about the hardware issue..."
                  rows={4}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)] resize-none"
                />
                {reqErrors.description && <p className="text-3xs text-red-400">{reqErrors.description.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Priority Level</label>
                <select
                  {...registerReq("priority")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="req-form"
            disabled={createRequestMutation.isPending}
            className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-3 text-xs font-semibold transition disabled:opacity-50 mt-4"
          >
            {createRequestMutation.isPending ? "Submitting ticket..." : "File Ticket"}
          </button>
        </div>
      )}

      {/* Resolution Notes Modal */}
      {resolvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h4 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Resolve Ticket
              </h4>
              <button onClick={() => setResolvingRequest(null)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const notes = new FormData(e.currentTarget).get("notes") as string;
                resolveRepairMutation.mutate({ id: resolvingRequest.id, notes });
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Resolution Action Notes</label>
                <textarea
                  name="notes"
                  required
                  placeholder="Describe repair actions taken (e.g. replaced SSD, cleaned dust)..."
                  rows={4}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={resolveRepairMutation.isPending}
                className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2.5 text-xs font-semibold transition disabled:opacity-50"
              >
                {resolveRepairMutation.isPending ? "Filing resolution..." : "Resolve Ticket"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
