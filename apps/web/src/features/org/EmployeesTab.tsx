"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { Role } from "@assetflow/shared";
import {
  useDepartments,
  useEmployees,
  usePromoteEmployee,
  useUpdateEmployee,
} from "./org-api";

interface EmployeesTabProps {
  isAdmin: boolean;
}

export default function EmployeesTab({ isAdmin }: EmployeesTabProps) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);

  const { data, isLoading, error } = useEmployees({
    page,
    pageSize: 10,
    q,
    departmentId,
    role: roleFilter,
    status: statusFilter,
  });

  const { data: allDepts } = useDepartments({ pageSize: 100, status: "Active" });

  const updateMutation = useUpdateEmployee(editingEmp?.id || "");
  const promoteMutation = usePromoteEmployee(editingEmp?.id || "");

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: "",
      departmentId: "",
      status: "Active",
      role: Role.Employee,
    },
  });

  const handleOpenEdit = (emp: any) => {
    setEditingEmp(emp);
    reset({
      name: emp.name,
      departmentId: emp.departmentId || "",
      status: emp.status,
      role: emp.role,
    });
    setModalOpen(true);
  };

  const onSubmit = async (formData: any) => {
    try {
      // 1. Update basic employee details
      await updateMutation.mutateAsync({
        name: formData.name,
        departmentId: formData.departmentId || null,
        status: formData.status,
      });

      // 2. Update role if it has changed
      if (formData.role !== editingEmp.role) {
        await promoteMutation.mutateAsync(formData.role);
      }

      setModalOpen(false);
    } catch (e: any) {
      alert(e.message || "Failed to update employee");
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case Role.Admin:
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      case Role.DepartmentHead:
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case Role.Employee:
      default:
        return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-4 py-2 text-sm text-[var(--af-text)] placeholder-[var(--af-muted)] focus:border-[var(--af-accent)] focus:outline-none sm:max-w-xs"
          />
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
          >
            <option value="">All Departments</option>
            {allDepts?.data.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
          >
            <option value="">All Roles</option>
            <option value={Role.Admin}>Admin</option>
            <option value={Role.DepartmentHead}>Department Head</option>
            <option value={Role.Employee}>Employee</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-sm text-[var(--af-muted)]">
          Loading employees...
        </div>
      ) : error ? (
        <div className="flex h-32 items-center justify-center text-sm text-red-500">
          Failed to load employees.
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--af-border)] text-sm text-[var(--af-muted)]">
          No employees found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--af-border)] bg-[var(--af-surface)]/40 backdrop-blur-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-xs font-semibold text-[var(--af-muted)] uppercase tracking-wider">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Status</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--af-border)]">
              {data.data.map((emp: any) => (
                <tr key={emp.id} className="transition hover:bg-[var(--af-surface-elevated)]/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--af-accent)]/10 text-xs font-bold text-[var(--af-accent)]">
                        {getInitials(emp.name)}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--af-text)]">{emp.name}</p>
                        <p className="text-xs text-[var(--af-muted)]">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleBadgeClass(emp.role)}`}>
                      {emp.role === Role.DepartmentHead ? "Department Head" : emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--af-muted)]">
                    {emp.department ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--af-surface-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--af-text)] border border-[var(--af-border)]/40">
                        {emp.department.name}
                      </span>
                    ) : (
                      <span className="text-xs italic text-[var(--af-muted)]">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        emp.status === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {emp.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(emp)}
                        className="rounded-lg p-1.5 text-[var(--af-muted)] hover:bg-[var(--af-surface-elevated)] hover:text-[var(--af-text)]"
                        title="Manage employee"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                      </button>
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

      {/* Edit Employee Modal */}
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
              <h3 className="text-lg font-semibold text-[var(--af-text)] mb-2">
                Manage Employee
              </h3>
              <p className="text-xs text-[var(--af-muted)] mb-4">
                {editingEmp?.email}
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Employee Name
                  </label>
                  <input
                    type="text"
                    required
                    {...register("name")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    Department Assignment
                  </label>
                  <select
                    {...register("departmentId")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {allDepts?.data.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--af-muted)] uppercase mb-1">
                    System Role
                  </label>
                  <select
                    {...register("role")}
                    className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface-elevated)] px-3 py-2 text-sm text-[var(--af-text)] focus:border-[var(--af-accent)] focus:outline-none"
                  >
                    <option value={Role.Employee}>Employee (Standard Access)</option>
                    <option value={Role.DepartmentHead}>Department Head</option>
                    <option value={Role.Admin}>Admin (Full Access)</option>
                  </select>
                </div>

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
                    disabled={updateMutation.isPending || promoteMutation.isPending}
                    className="rounded-lg bg-[var(--af-accent)] px-4 py-2 text-sm font-medium text-[#042f2e] transition hover:bg-[var(--af-accent-hover)] disabled:opacity-50"
                  >
                    Save Changes
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
