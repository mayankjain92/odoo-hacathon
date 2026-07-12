"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import {
  useCreateDepartment,
  useDeactivateDepartment,
  useDepartments,
  useEmployees,
  useUpdateDepartment,
} from "./org-api";

interface DepartmentsTabProps {
  isAdmin: boolean;
}

export default function DepartmentsTab({ isAdmin }: DepartmentsTabProps) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);

  const { data, isLoading, error } = useDepartments({ page, pageSize: 10, q, status });

  // For parent/head select options
  const { data: allDepts } = useDepartments({ pageSize: 100, status: "Active" });
  const { data: allEmployees } = useEmployees({ pageSize: 100, status: "Active" });

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment(editingDept?.id || "");
  const deactivateMutation = useDeactivateDepartment();

  const { register, handleSubmit, reset, setValue } = useForm({
    defaultValues: {
      name: "",
      parentId: "",
      headId: "",
      status: "Active",
    },
  });

  const handleOpenCreate = () => {
    setEditingDept(null);
    reset({
      name: "",
      parentId: "",
      headId: "",
      status: "Active",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (dept: any) => {
    setEditingDept(dept);
    reset({
      name: dept.name,
      parentId: dept.parentId || "",
      headId: dept.headId || "",
      status: dept.status,
    });
    setModalOpen(true);
  };

  const onSubmit = async (formData: any) => {
    const payload = {
      name: formData.name,
      parentId: formData.parentId || null,
      headId: formData.headId || null,
      status: formData.status,
    };

    try {
      if (editingDept) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to save department");
    }
  };

  const handleDeactivate = async (id: string) => {
    if (confirm("Are you sure you want to deactivate this department?")) {
      try {
        await deactivateMutation.mutateAsync(id);
      } catch (e: any) {
        alert(e.message || "Failed to deactivate department");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search departments..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-4 py-2 text-sm text-[var(--af-text)] placeholder-[var(--af-muted)] focus:border-[var(--af-accent)] focus:outline-none sm:max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 rounded-lg bg-[var(--af-accent)] px-4 py-2 text-sm font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Department
          </button>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--af-muted)]">
          Loading departments...
        </div>
      ) : error ? (
        <div className="flex h-32 items-center justify-center text-sm text-red-500">
          Failed to load departments.
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--af-border)] text-sm text-[var(--af-muted)]">
          No departments found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)]/40 backdrop-blur-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-xs font-semibold text-[var(--af-muted)] uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Parent Dept</th>
                <th className="px-6 py-4">Department Head</th>
                <th className="px-6 py-4">Metrics</th>
                <th className="px-6 py-4">Status</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)]">
              {data.data.map((dept: any) => (
                <tr key={dept.id} className="transition hover:bg-[var(--af-surface-elevated)]/40">
                  <td className="px-6 py-4 font-medium text-[var(--af-text)]">{dept.name}</td>
                  <td className="px-6 py-4 text-[var(--af-muted)]">
                    {dept.parent ? dept.parent.name : "None"}
                  </td>
                  <td className="px-6 py-4 text-[var(--af-muted)]">
                    {dept.head ? dept.head.name : "None"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-[var(--af-surface-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--af-muted)]">
                        {dept._count?.users ?? 0} Staff
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[var(--af-surface-elevated)] px-2 py-0.5 text-xs font-medium text-[var(--af-muted)]">
                        {dept._count?.assets ?? 0} Assets
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        dept.status === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {dept.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(dept)}
                          className="rounded-lg p-1.5 text-[var(--af-muted)] hover:bg-[var(--af-surface-elevated)] hover:text-[var(--af-text)]"
                          title="Edit department"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        {dept.status === "Active" && (
                          <button
                            onClick={() => handleDeactivate(dept.id)}
                            className="rounded-lg p-1.5 text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400"
                            title="Deactivate department"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-between items-center px-2 py-4">
          <p className="text-xs text-[var(--af-muted)]">
            Showing Page {page} of {data.meta.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-[var(--af-border)] px-3 py-1 text-xs text-[var(--af-text)] disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(data.meta.totalPages, p + 1))}
              disabled={page === data.meta.totalPages}
              className="rounded-lg border border-[var(--af-border)] px-3 py-1 text-xs text-[var(--af-text)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)] p-6 shadow-xl"
            >
              <h3 className="text-lg font-semibold text-[var(--af-text)] mb-4">
                {editingDept ? "Edit Department" : "Add Department"}
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    required
                    {...register("name")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                    placeholder="Engineering, Operations, etc."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Parent Department
                  </label>
                  <select
                    {...register("parentId")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                  >
                    <option value="">None (Top-Level)</option>
                    {allDepts?.data
                      .filter((d: any) => d.id !== editingDept?.id)
                      .map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Department Head
                  </label>
                  <select
                    {...register("headId")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                  >
                    <option value="">None Selected</option>
                    {allEmployees?.data.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.email})
                      </option>
                    ))}
                  </select>
                </div>

                {editingDept && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                      Status
                    </label>
                    <select
                      {...register("status")}
                      className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-[var(--af-border)] px-4 py-2 text-sm font-medium text-[var(--af-text)] transition hover:bg-[var(--af-surface-elevated)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="rounded-lg bg-[var(--af-accent)] px-4 py-2 text-sm font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
