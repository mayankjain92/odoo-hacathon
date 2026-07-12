"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AuditCycleStatus, AuditItemResult, Role } from "@assetflow/shared";
import {
  ShieldCheck, Plus, X, Lock, Eye, PlayCircle, Search, CheckCircle, AlertTriangle, Calendar
} from "lucide-react";

export default function AuditsPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeConsoleId, setActiveConsoleId] = useState<string | null>(null);
  const [scanTag, setScanTag] = useState("");
  const [scanResult, setScanResult] = useState<"Verified" | "Missing" | "Damaged">("Verified");
  const [scanNotes, setScanNotes] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);

  // Form state (controlled)
  const [form, setForm] = useState({
    name: "", departmentId: "", location: "", startsAt: "", endsAt: "", auditorIds: [] as string[],
  });

  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: deptsRes } = useQuery<{ data: any[] }>({
    queryKey: ["departments"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/departments"),
  });
  const departments = deptsRes?.data || [];

  const { data: employeesRes } = useQuery<any>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/org/employees"),
  });
  const employees = employeesRes?.data || [];

  const { data: auditsRes, isLoading } = useQuery<{ data: any[]; meta: any }>({
    queryKey: ["audits"],
    queryFn: () => apiFetch<{ data: any[]; meta: any }>("/audits"),
  });
  const audits = auditsRes?.data || [];

  // Detail query for the open console cycle
  const { data: cycleDetail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["audits", activeConsoleId],
    queryFn: () => apiFetch<any>(`/audits/${activeConsoleId}`),
    enabled: !!activeConsoleId,
  });

  const isEditor = user?.role === Role.Admin || user?.role === Role.AssetManager;

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createCycleMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/audits", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      setShowCreateForm(false);
      setForm({ name: "", departmentId: "", location: "", startsAt: "", endsAt: "", auditorIds: [] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/audits/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      queryClient.invalidateQueries({ queryKey: ["audits", activeConsoleId] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: ({ id, assetTag, result, notes }: { id: string; assetTag: string; result: string; notes?: string }) =>
      apiFetch(`/audits/${id}/scan`, {
        method: "POST",
        body: JSON.stringify({ assetTag: assetTag.trim().toUpperCase(), result, notes: notes || undefined }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["audits", vars.id] });
      setScanSuccess(`Asset ${vars.assetTag} recorded as ${vars.result}`);
      setScanTag("");
      setScanNotes("");
      setScanError(null);
      setTimeout(() => setScanSuccess(null), 3000);
    },
    onError: (err: any) => {
      setScanError(err?.message || "Asset tag not found or out of scope.");
    },
  });

  const STATUS_BADGE: Record<string, string> = {
    [AuditCycleStatus.Open]: "bg-neutral-900 text-neutral-400 border-neutral-700",
    [AuditCycleStatus.InProgress]: "bg-amber-950 text-amber-400 border-amber-800/40 animate-pulse",
    [AuditCycleStatus.Closed]: "bg-emerald-950 text-emerald-400 border-emerald-800/40",
  };

  const RESULT_COLORS: Record<string, string> = {
    [AuditItemResult.Verified]: "text-emerald-400",
    [AuditItemResult.Missing]: "text-rose-400 font-bold",
    [AuditItemResult.Damaged]: "text-amber-400",
  };

  const handleAuditorToggle = (userId: string) => {
    setForm(f => ({
      ...f,
      auditorIds: f.auditorIds.includes(userId)
        ? f.auditorIds.filter(id => id !== userId)
        : [...f.auditorIds, userId],
    }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.startsAt || !form.endsAt) return;
    createCycleMutation.mutate({
      name: form.name,
      departmentId: form.departmentId || undefined,
      location: form.location || undefined,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      auditorIds: form.auditorIds.length ? form.auditorIds : undefined,
    });
  };

  // ─── Render: Auditor Console ───────────────────────────────────────────────
  if (activeConsoleId && cycleDetail) {
    const items: any[] = cycleDetail.items || [];
    const verifiedCount = items.filter((i: any) => i.result === AuditItemResult.Verified).length;
    const missingCount = items.filter((i: any) => i.result === AuditItemResult.Missing).length;
    const damagedCount = items.filter((i: any) => i.result === AuditItemResult.Damaged).length;
    const isInProgress = cycleDetail.status === AuditCycleStatus.InProgress;

    return (
      <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
        {/* Console header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[var(--af-surface)]/60 border border-[var(--af-border)] rounded-lg p-5 gap-4">
          <div className="space-y-1">
            <span className="text-3xs uppercase tracking-wider text-[var(--af-accent)] font-semibold font-mono">Verification Workspace</span>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white">{cycleDetail.name}</h3>
            <p className="text-2xs text-[var(--af-muted)]">
              Status: <span className={`font-semibold ${cycleDetail.status === AuditCycleStatus.InProgress ? "text-amber-400" : cycleDetail.status === AuditCycleStatus.Closed ? "text-emerald-400" : "text-neutral-300"}`}>{cycleDetail.status}</span>
              {cycleDetail.department && <> · Dept: <strong className="text-neutral-300">{cycleDetail.department.name}</strong></>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveConsoleId(null)} className="rounded-lg border border-[var(--af-border)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer">
              Exit Console
            </button>
            {isEditor && cycleDetail.status === AuditCycleStatus.Open && (
              <button
                onClick={() => updateStatusMutation.mutate({ id: cycleDetail.id, status: AuditCycleStatus.InProgress })}
                disabled={updateStatusMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition cursor-pointer"
              >
                <PlayCircle className="h-4 w-4" /> Start Audit
              </button>
            )}
            {isEditor && cycleDetail.status === AuditCycleStatus.InProgress && (
              <button
                onClick={() => { updateStatusMutation.mutate({ id: cycleDetail.id, status: AuditCycleStatus.Closed }); setActiveConsoleId(null); }}
                disabled={updateStatusMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition cursor-pointer"
              >
                <Lock className="h-4 w-4" /> Lock & Close Cycle
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-2xs text-[var(--af-muted)]">Verified</p>
            <p className="text-2xl font-bold text-emerald-400">{verifiedCount}</p>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <p className="text-2xs text-[var(--af-muted)]">Missing</p>
            <p className="text-2xl font-bold text-rose-400">{missingCount}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-2xs text-[var(--af-muted)]">Damaged</p>
            <p className="text-2xl font-bold text-amber-400">{damagedCount}</p>
          </div>
        </div>

        {/* Scan input (only when InProgress) */}
        {isInProgress && (
          <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-3">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--af-accent)]" /> Scan Asset Tag
            </h4>
            {scanError && <div className="rounded border border-red-800/60 bg-red-950/30 p-2 text-xs text-red-400">{scanError}</div>}
            {scanSuccess && <div className="rounded border border-emerald-800/60 bg-emerald-950/30 p-2 text-xs text-emerald-400">{scanSuccess}</div>}
            <div className="flex gap-2">
              <input
                value={scanTag}
                onChange={e => { setScanTag(e.target.value); setScanError(null); }}
                onKeyDown={e => { if (e.key === "Enter" && scanTag.trim()) scanMutation.mutate({ id: cycleDetail.id, assetTag: scanTag, result: scanResult, notes: scanNotes }); }}
                placeholder="e.g. AF-0001"
                className="flex-1 rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
              />
              <select
                value={scanResult}
                onChange={e => setScanResult(e.target.value as any)}
                className="rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
              >
                <option value={AuditItemResult.Verified}>Verified</option>
                <option value={AuditItemResult.Missing}>Missing</option>
                <option value={AuditItemResult.Damaged}>Damaged</option>
              </select>
              <button
                onClick={() => scanTag.trim() && scanMutation.mutate({ id: cycleDetail.id, assetTag: scanTag, result: scanResult, notes: scanNotes })}
                disabled={scanMutation.isPending || !scanTag.trim()}
                className="rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4 py-2 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {scanMutation.isPending ? "..." : "Record"}
              </button>
            </div>
            <input
              value={scanNotes}
              onChange={e => setScanNotes(e.target.value)}
              placeholder="Notes (optional)..."
              className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
            />
          </div>
        )}

        {/* Scanned items table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/40">
          <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold text-2xs">
                <th className="px-5 py-3">Asset Tag</th>
                <th className="px-5 py-3">Asset Name</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)]">
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--af-muted)] text-xs">No assets scanned yet. Use the scan input above.</td></tr>
              ) : (
                items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[var(--af-surface)]/20 transition">
                    <td className="px-5 py-3 font-mono font-semibold text-[var(--af-accent)]">{item.asset?.assetTag ?? "—"}</td>
                    <td className="px-5 py-3 font-medium text-white">{item.asset?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--af-muted)]">{item.asset?.status ?? "—"}</td>
                    <td className={`px-5 py-3 font-semibold ${RESULT_COLORS[item.result] ?? "text-[var(--af-muted)]"}`}>{item.result}</td>
                    <td className="px-5 py-3 text-[var(--af-muted)]">{item.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Closed summary */}
        {cycleDetail.status === AuditCycleStatus.Closed && missingCount > 0 && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-5 space-y-2">
            <h4 className="font-semibold text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Audit Discrepancy Summary
            </h4>
            <p className="text-xs text-neutral-400">
              {missingCount} asset(s) flagged as <strong className="text-rose-400">Missing</strong> have been automatically transitioned to <strong className="text-red-400 font-mono">Lost</strong> status.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Main list ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">Asset Verification Audits</h2>
          <p className="text-sm text-[var(--af-muted)]">Schedule compliance checks, scan assets, and resolve inventory discrepancies.</p>
        </div>
        {isEditor && (
          <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4 py-2.5 text-xs font-semibold transition cursor-pointer shrink-0">
            <Plus className="h-4 w-4" /> Schedule Audit Cycle
          </button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Cycle list */}
        <div className="md:col-span-2 space-y-4">
          {isLoading ? (
            <div className="text-[var(--af-muted)] text-sm">Loading audit cycles...</div>
          ) : audits.length === 0 ? (
            <div className="rounded-lg border border-[var(--af-border)] p-8 text-center text-[var(--af-muted)] text-sm">
              No audit cycles yet. Create one to get started.
            </div>
          ) : (
            audits.map((cycle: any) => {
              const dept = departments.find((d: any) => d.id === cycle.departmentId);
              const auditorNames = (cycle.auditors || [])
                .map((a: any) => a.user?.name ?? "?")
                .join(", ") || "Unassigned";

              return (
                <div key={cycle.id} className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{cycle.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold border ${STATUS_BADGE[cycle.status] ?? "bg-neutral-900 text-neutral-400 border-neutral-700"}`}>
                      {cycle.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-[var(--af-muted)]">
                    {dept && <div>Department: <strong className="text-neutral-300">{dept.name}</strong></div>}
                    {cycle.location && <div>Location: <strong className="text-neutral-300">{cycle.location}</strong></div>}
                    <div>Auditors: <strong className="text-neutral-300">{auditorNames}</strong></div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(cycle.startsAt).toLocaleDateString()} – {new Date(cycle.endsAt).toLocaleDateString()}
                    </div>
                    <div>Items scanned: <strong className="text-neutral-300">{cycle._count?.items ?? 0}</strong></div>
                  </div>
                  <div className="border-t border-[var(--af-border)] pt-3 flex justify-end">
                    <button
                      onClick={() => setActiveConsoleId(cycle.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3.5 py-1.5 text-2xs text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {cycle.status === AuditCycleStatus.Closed ? "View Report" : "Open Console"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Create form */}
        {showCreateForm && (
          <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h4 className="font-semibold text-white text-sm">Schedule Audit</h4>
              <button onClick={() => setShowCreateForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
            </div>

            {createCycleMutation.isError && (
              <div className="rounded border border-red-800/60 bg-red-950/30 p-2 text-xs text-red-400">Failed to create audit cycle.</div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {[
                { label: "Cycle Name *", field: "name", type: "text", placeholder: "Q3 Hardware Audit..." },
                { label: "Location (optional)", field: "location", type: "text", placeholder: "Floor 2, Building A" },
              ].map(({ label, field, type, placeholder }) => (
                <div className="space-y-1" key={field}>
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">{label}</label>
                  <input type={type} value={(form as any)[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]" />
                </div>
              ))}

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Department (optional)</label>
                <select value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]">
                  <option value="">All Departments</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Start Date *</label>
                  <input type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">End Date *</label>
                  <input type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Auditors (select multiple)</label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-[var(--af-border)] rounded-md p-2">
                  {employees.map((e: any) => (
                    <label key={e.id} className="flex items-center gap-2 text-xs text-white cursor-pointer hover:text-[var(--af-accent)]">
                      <input type="checkbox" checked={form.auditorIds.includes(e.id)} onChange={() => handleAuditorToggle(e.id)} className="accent-teal-500" />
                      {e.name} <span className="text-[var(--af-muted)]">({e.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={createCycleMutation.isPending || !form.name || !form.startsAt || !form.endsAt}
                className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer">
                {createCycleMutation.isPending ? "Creating..." : "Schedule Audit Cycle"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  Open: "bg-neutral-900 text-neutral-400 border-neutral-700",
  InProgress: "bg-amber-950 text-amber-400 border-amber-800/40",
  Closed: "bg-emerald-950 text-emerald-400 border-emerald-800/40",
};
