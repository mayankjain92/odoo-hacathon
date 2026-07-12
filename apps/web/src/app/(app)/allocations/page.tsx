"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiClientError } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Role } from "@assetflow/shared";
import {
  Plus,
  ArrowRightLeft,
  X,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileCheck,
  Ban,
  Clock
} from "lucide-react";
import { useSearchParams } from "next/navigation";

const allocationFormSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  employeeId: z.string().min(1, "Employee is required"),
  expectedReturnAt: z.string().optional().nullable().or(z.literal("")),
});

export default function AllocationsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Tab State
  const [activeTab, setActiveTab] = useState<"active" | "transfers">("active");

  // Show Forms/Dialogs State
  const [showAllocDrawer, setShowAllocDrawer] = useState(false);
  const [conflictModal, setConflictModal] = useState<any | null>(null);

  // Trigger tab/actions via query params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "transfers") {
      setActiveTab("transfers");
    }
    const actionParam = searchParams.get("action");
    if (actionParam === "transfer") {
      setShowAllocDrawer(true);
    }
  }, [searchParams]);

  // Queries
  const { data: user } = useQuery<any>({ queryKey: ["auth-user"] });

  const { data: assetsRes } = useQuery<{ data: any[] }>({
    queryKey: ["assets"],
    queryFn: () => apiFetch<{ data: any[] }>("/assets?pageSize=100"),
  });
  const assets = assetsRes?.data || [];

  const { data: employeesRes } = useQuery<any>({
    queryKey: ["employees"],
    queryFn: () => apiFetch("/org/employees"),
  });
  const employees = employeesRes?.data || [];

  const { data: allocationsRes } = useQuery<{ data: any[] }>({
    queryKey: ["allocations"],
    queryFn: () => apiFetch<{ data: any[] }>("/allocations"),
  });
  const allocations = allocationsRes?.data || [];

  const { data: transfersRes } = useQuery<{ data: any[] }>({
    queryKey: ["transfers"],
    queryFn: () => apiFetch<{ data: any[] }>("/allocations/transfers"),
  });
  const transfers = transfersRes?.data || [];

  // Form for New Allocation
  const {
    register: registerAlloc,
    handleSubmit: handleSubmitAlloc,
    reset: resetAlloc,
    watch: watchAlloc,
    formState: { errors: allocErrors },
  } = useForm({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      assetId: "",
      employeeId: "",
      expectedReturnAt: "",
    },
  });

  const selectedAssetId = watchAlloc("assetId");
  const selectedAssetObj = assets.find(a => a.id === selectedAssetId);

  // Allocate mutation
  const allocateMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        assetId: data.assetId,
        employeeId: data.employeeId || undefined,
        expectedReturnAt: data.expectedReturnAt ? new Date(data.expectedReturnAt).toISOString() : undefined,
      };
      return apiFetch("/allocations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      resetAlloc();
      setShowAllocDrawer(false);
    },
    onError: (err: ApiClientError) => {
      // Catch 409 conflict error representing already allocated asset
      if (err.statusCode === 409) {
        // Collect current holder name & allocation details from conflict response
        const details = err.details as any;
        const holderName = details?.currentHolder?.name || "another employee";
        const allocationId = details?.allocationId;
        setConflictModal({
          assetId: selectedAssetId,
          employeeId: watchAlloc("employeeId"),
          expectedReturnAt: watchAlloc("expectedReturnAt"),
          holderName,
          allocationId,
          assetName: selectedAssetObj?.name || "Asset"
        });
      } else {
        alert(err.message || "Failed to create allocation");
      }
    }
  });

  // Transfer Mutation (initiates transfer from the 409 modal)
  const transferMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/allocations/transfers", {
      method: "POST",
      body: JSON.stringify({
        assetId: data.assetId,
        requestingEmployeeId: data.employeeId,
        reason: `Automated transfer request due to allocation conflict from existing holder: ${data.holderName}`,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setConflictModal(null);
      setShowAllocDrawer(false);
      setActiveTab("transfers");
    },
    onError: (err: ApiClientError) => {
      alert(err.message || "Failed to register transfer request");
    }
  });

  // Return allocation mutation
  const returnMutation = useMutation({
    mutationFn: (allocationId: string) => apiFetch(`/allocations/${allocationId}/return`, {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  // Resolve Transfer (Approve/Reject) mutation
  const resolveTransferMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) => {
      return apiFetch(`/allocations/transfers/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  const isEditor = user?.role === Role.Admin || user?.role === Role.AssetManager;
  const isApprover = user?.role === Role.Admin || user?.role === Role.AssetManager || user?.role === Role.DepartmentHead;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Allocations & Transfers
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Delegate workspace hardware to employees and orchestrate team resource transfers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Selection */}
          <div className="flex bg-[var(--af-surface)]/80 p-1.5 rounded-lg border border-[var(--af-border)]">
            <button
              onClick={() => setActiveTab("active")}
              className={`rounded-md px-4 py-2 text-xs font-semibold tracking-wide transition cursor-pointer ${
                activeTab === "active"
                  ? "bg-[var(--af-surface-elevated)] text-[var(--af-accent)] border border-[var(--af-border)]"
                  : "text-[var(--af-muted)] hover:text-white"
              }`}
            >
              Active Assignments
            </button>
            <button
              onClick={() => setActiveTab("transfers")}
              className={`rounded-md px-4 py-2 text-xs font-semibold tracking-wide transition cursor-pointer ${
                activeTab === "transfers"
                  ? "bg-[var(--af-surface-elevated)] text-[var(--af-accent)] border border-[var(--af-border)]"
                  : "text-[var(--af-muted)] hover:text-white"
              }`}
            >
              Transfer Requests
            </button>
          </div>

          {isEditor && (
            <button
              onClick={() => setShowAllocDrawer(true)}
              className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2.5 text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Allocation
            </button>
          )}
        </div>
      </div>

      {/* Tab: Active Assignments */}
      {activeTab === "active" && (
        <div className="overflow-x-auto rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40">
          <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Asset Code</th>
                <th className="px-6 py-4">Asset Name</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Allocation Date</th>
                <th className="px-6 py-4">Expected Return</th>
                <th className="px-6 py-4">Status</th>
                {isEditor && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)] bg-transparent">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--af-muted)]">
                    No active allocations found in the register.
                  </td>
                </tr>
              ) : (
                allocations.map((alloc: any) => {
                  const asset = assets.find((a: any) => a.id === alloc.assetId);
                  const emp = employees.find((e: any) => e.id === alloc.employeeId);
                  const isOverdue = alloc.expectedReturnAt && new Date(alloc.expectedReturnAt) < new Date() && !alloc.returnedAt;

                  return (
                    <tr key={alloc.id} className="hover:bg-[var(--af-surface)]/20 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-[var(--af-accent)]">
                        {asset ? asset.assetTag : "AF-XXXX"}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{asset ? asset.name : "Asset"}</td>
                      <td className="px-6 py-4">{emp ? emp.name : "Employee"}</td>
                      <td className="px-6 py-4">{new Date(alloc.allocatedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono">
                        {alloc.expectedReturnAt ? (
                          <span className={isOverdue ? "text-red-400 font-semibold" : "text-neutral-300"}>
                            {new Date(alloc.expectedReturnAt).toLocaleDateString()}
                          </span>
                        ) : (
                          "Indefinite"
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {alloc.returnedAt ? (
                          <span className="rounded bg-emerald-950 text-emerald-400 px-2 py-0.5 text-3xs font-semibold">Returned</span>
                        ) : isOverdue ? (
                          <span className="rounded bg-red-950 text-red-400 px-2 py-0.5 text-3xs font-semibold animate-pulse">Overdue</span>
                        ) : (
                          <span className="rounded bg-cyan-950 text-cyan-400 px-2 py-0.5 text-3xs font-semibold">Active</span>
                        )}
                      </td>
                      {isEditor && (
                        <td className="px-6 py-4 text-right">
                          {!alloc.returnedAt && (
                            <button
                              onClick={() => returnMutation.mutate(alloc.id)}
                              disabled={returnMutation.isPending}
                              className="rounded border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3 py-1.5 text-2xs text-white hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
                            >
                              Check-In Asset
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Transfer Requests */}
      {activeTab === "transfers" && (
        <div className="overflow-x-auto rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40">
          <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold">
                <th className="px-6 py-4">Asset Tag</th>
                <th className="px-6 py-4">Asset Name</th>
                <th className="px-6 py-4">Current Holder</th>
                <th className="px-6 py-4">Requesting Assignee</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                {isApprover && <th className="px-6 py-4 text-right">Resolutions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)] bg-transparent">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-[var(--af-muted)]">
                    No active or historical transfer requests.
                  </td>
                </tr>
              ) : (
                transfers.map((tr: any) => {
                  const asset = assets.find((a: any) => a.id === tr.assetId);
                  const requester = employees.find((e: any) => e.id === tr.requestingEmployeeId);
                  const holder = employees.find((e: any) => e.id === tr.currentHolderId);

                  return (
                    <tr key={tr.id} className="hover:bg-[var(--af-surface)]/20 transition">
                      <td className="px-6 py-4 font-mono font-semibold text-[var(--af-accent)]">
                        {asset ? asset.assetTag : "AF-XXXX"}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{asset ? asset.name : "Asset"}</td>
                      <td className="px-6 py-4">{holder ? holder.name : "Unassigned"}</td>
                      <td className="px-6 py-4 font-semibold text-white">{requester ? requester.name : "Employee"}</td>
                      <td className="px-6 py-4 max-w-xs truncate text-[var(--af-muted)]">{tr.reason || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${
                          tr.status === "Approved" ? "text-emerald-400" :
                          tr.status === "Rejected" ? "text-red-400" : "text-amber-400"
                        }`}>
                          {tr.status}
                        </span>
                      </td>
                      {isApprover && (
                        <td className="px-6 py-4 text-right">
                          {tr.status === "Pending" && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => resolveTransferMutation.mutate({ id: tr.id, status: "Approved" })}
                                className="inline-flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-400 hover:bg-emerald-900/60 px-2.5 py-1 text-2xs font-medium cursor-pointer"
                              >
                                <FileCheck className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => resolveTransferMutation.mutate({ id: tr.id, status: "Rejected" })}
                                className="inline-flex items-center gap-1 rounded bg-red-950 border border-red-800/80 text-red-400 hover:bg-red-900/60 px-2.5 py-1 text-2xs font-medium cursor-pointer"
                              >
                                <Ban className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocate Drawer */}
      {showAllocDrawer && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--af-surface)] border-l border-[var(--af-border)] p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-[var(--af-accent)]" />
                Allocate Equipment
              </h3>
              <button onClick={() => setShowAllocDrawer(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="alloc-form" onSubmit={handleSubmitAlloc((data) => allocateMutation.mutate(data))} className="space-y-4">
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Select Asset</label>
                <select
                  {...registerAlloc("assetId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Choose Asset</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.assetTag}) - {a.status}</option>
                  ))}
                </select>
                {allocErrors.assetId && <p className="text-3xs text-red-400">{allocErrors.assetId.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Assign To Employee</label>
                <select
                  {...registerAlloc("employeeId")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Select Assignee</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
                {allocErrors.employeeId && <p className="text-3xs text-red-400">{allocErrors.employeeId.message}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Expected Return Date</label>
                <input
                  type="date"
                  {...registerAlloc("expectedReturnAt")}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                />
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="alloc-form"
            disabled={allocateMutation.isPending}
            className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-3 text-xs font-semibold transition disabled:opacity-50 mt-4"
          >
            {allocateMutation.isPending ? "Configuring allocation..." : "Confirm Allocation"}
          </button>
        </div>
      )}

      {/* 409 Conflict Dialog Flow */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-red-900/50 bg-[var(--af-surface)] p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-950 border border-red-800 p-2 text-red-400 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-[family-name:var(--font-display)] text-base font-bold text-white">
                  Asset Already Allocated
                </h4>
                <p className="text-xs text-[var(--af-muted)]">
                  The asset <strong className="text-white">{conflictModal.assetName}</strong> is currently assigned to <strong className="text-[var(--af-accent)]">{conflictModal.holderName}</strong>.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-[var(--af-surface-elevated)]/60 border border-[var(--af-border)] p-3 text-2xs text-[var(--af-muted)]">
              <p>
                To reassign this asset, you must either check it in from the current holder first or request an inter-departmental transfer.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConflictModal(null)}
                className="flex-1 rounded border border-[var(--af-border)] py-2 text-xs font-medium text-white hover:bg-[var(--af-surface-elevated)] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => transferMutation.mutate(conflictModal)}
                disabled={transferMutation.isPending}
                className="flex-1 rounded bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2 text-xs font-semibold transition"
              >
                {transferMutation.isPending ? "Requesting..." : "Request Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
