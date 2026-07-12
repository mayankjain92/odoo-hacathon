"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  Calendar,
  Wrench,
  FolderSync
} from "lucide-react";

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  // Queries
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: notificationsRes, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ data: any[] }>("/notifications"),
  });
  const notifications = notificationsRes?.data || [];

  // Mutations
  const readAllMutation = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () => apiFetch("/notifications", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Decide icon based on type
  const getNotificationIcon = (type: string) => {
    const t = (type || "").toLowerCase();
    if (t.includes("overdue") || t.includes("discrepancy"))
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    if (t.includes("maintenance"))
      return <Wrench className="h-4 w-4 text-amber-400" />;
    if (t.includes("booking"))
      return <Calendar className="h-4 w-4 text-cyan-400" />;
    if (t.includes("transfer"))
      return <FolderSync className="h-4 w-4 text-indigo-400" />;
    return <Info className="h-4 w-4 text-neutral-400" />;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Bell className="h-6 w-6 text-[var(--af-accent)]" />
            Operations Activity Log
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Review audit tracking, maintenance schedules, allocation transfers, and compliance alerts.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4 text-[var(--af-success)]" />
              Mark All Read
            </button>

            <button
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--af-border)] bg-red-950/20 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear Log
            </button>
          </div>
        )}
      </div>

      {/* Notifications list feed */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="text-center py-12 text-xs text-[var(--af-muted)]">Loading log feed...</div>
        ) : notifications.length === 0 ? (
          <div className="rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/30 p-12 text-center text-xs text-[var(--af-muted)] space-y-2">
            <Bell className="h-8 w-8 text-neutral-600 mx-auto" />
            <p>No operational activities or notifications registered.</p>
          </div>
        ) : (
          notifications.map((notif: any) => (
            <div
              key={notif.id}
              className={`rounded-lg border p-4.5 transition flex gap-3.5 items-start ${
                notif.readAt
                  ? "border-[var(--af-border)] bg-[var(--af-surface)]/40 opacity-75"
                  : "border-[var(--af-accent)]/20 bg-[var(--af-surface)]/80 shadow-md"
              }`}
            >
              <div className={`rounded-lg p-2 shrink-0 ${
                notif.readAt ? "bg-[var(--af-surface-elevated)]/40" : "bg-[var(--af-accent)]/5"
              }`}>
                {getNotificationIcon(notif.type)}
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex justify-between items-start gap-4">
                  <h4 className={`text-xs font-semibold ${notif.readAt ? "text-neutral-300" : "text-white"}`}>
                    {notif.title}
                  </h4>
                  <span className="text-3xs font-mono text-[var(--af-muted)] whitespace-nowrap">
                    {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-2xs text-[var(--af-muted)] leading-relaxed">
                  {notif.body}
                </p>
              </div>

              {!notif.readAt && (
                <span className="h-2 w-2 rounded-full bg-[var(--af-accent)] shrink-0 self-center"></span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
