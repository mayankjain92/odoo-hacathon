"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDepartmentSchema, createAssetCategorySchema, Role, EntityStatus } from "@assetflow/shared";
import { Plus, ShieldAlert, Award, User, Server, Layers, Settings, X, Search, ChevronRight } from "lucide-react";

export default function OrgPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"departments" | "categories" | "employees">("departments");
  const [promotingEmployee, setPromotingEmployee] = useState<any | null>(null);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);

  // Search state for employees
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("");

  // Queries
  const { data: deptsRes } = useQuery<{ data: any[] }>({
    queryKey: ["departments"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/departments"),
  });

  const { data: catsRes } = useQuery<{ data: any[] }>({
    queryKey: ["categories"],
    queryFn: () => apiFetch<{ data: any[] }>("/org/categories"),
  });

  const { data: employeesRes } = useQuery<any>({
    queryKey: ["employees", employeeSearch, employeeRoleFilter],
    queryFn: () => apiFetch(`/org/employees?q=${employeeSearch}&role=${employeeRoleFilter}`),
  });

  const departments = deptsRes?.data || [];
  const categories = catsRes?.data || [];
  const employees = employeesRes?.data || [];

  // Form for Department
  const {
    register: registerDept,
    handleSubmit: handleSubmitDept,
    reset: resetDept,
    formState: { errors: deptErrors },
  } = useForm({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      name: "",
      parentId: "",
      headId: "",
      status: EntityStatus.Active,
    },
  });

  const addDeptMutation = useMutation({
    mutationFn: (data: any) => apiFetch("/org/departments", {
      method: "POST",
      body: JSON.stringify({
        ...data,
        parentId: data.parentId || null,
        headId: data.headId || null,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      resetDept();
      setShowDeptForm(false);
    },
  });

  // Form for Category
  const {
    register: registerCat,
    handleSubmit: handleSubmitCat,
    reset: resetCat,
    formState: { errors: catErrors },
  } = useForm({
    resolver: zodResolver(createAssetCategorySchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Dynamic optional fields setup
  const [optFields, setOptFields] = useState<{ key: string; type: string }[]>([]);
  const addOptField = () => setOptFields([...optFields, { key: "", type: "string" }]);
  const removeOptField = (idx: number) => setOptFields(optFields.filter((_, i) => i !== idx));

  const addCatMutation = useMutation({
    mutationFn: (data: any) => {
      const optionalFields: Record<string, string> = {};
      optFields.forEach(f => {
        if (f.key) optionalFields[f.key] = f.type;
      });
      return apiFetch("/org/categories", {
        method: "POST",
        body: JSON.stringify({ ...data, optionalFields }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      resetCat();
      setOptFields([]);
      setShowCatForm(false);
    },
  });

  // Role Promotion Mutation
  const promoteMutation = useMutation({
    mutationFn: (data: { employeeId: string; role: Role; departmentId?: string }) => {
      return apiFetch(`/org/employees/${data.employeeId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: data.role, departmentId: data.departmentId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setPromotingEmployee(null);
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--af-border)] pb-5">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Organization Settings
          </h2>
          <p className="text-sm text-[var(--af-muted)]">
            Manage company structure, custom categories, and adjust employee roles.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[var(--af-surface)]/80 p-1.5 rounded-lg border border-[var(--af-border)] self-start sm:self-auto">
          {[
            { id: "departments", label: "Departments", icon: Server },
            { id: "categories", label: "Categories", icon: Layers },
            { id: "employees", label: "Employees", icon: User },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold tracking-wide transition cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[var(--af-surface-elevated)] text-[var(--af-accent)] border border-[var(--af-border)]"
                    : "text-[var(--af-muted)] hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: Departments */}
      {activeTab === "departments" && (
        <div className="grid gap-6 md:grid-cols-3 items-start">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider text-[var(--af-muted)]">Active Hierarchy</h3>
              <button
                onClick={() => setShowDeptForm(!showDeptForm)}
                className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Department
              </button>
            </div>

            {/* Department Tree/List */}
            <div className="grid gap-3 sm:grid-cols-2">
              {departments.map((dept) => {
                const parent = departments.find(d => d.id === dept.parentId);
                const manager = employees.find((u: any) => u.id === dept.headId);
                return (
                  <div
                    key={dept.id}
                    className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-semibold text-white">{dept.name}</span>
                      <span className="rounded-full bg-[var(--af-accent)]/10 px-2.5 py-0.5 text-3xs font-semibold text-[var(--af-accent)] font-mono">
                        {dept.status}
                      </span>
                    </div>
                    <div className="text-xs space-y-1.5 text-[var(--af-muted)]">
                      {parent && (
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className="h-3 w-3" />
                          <span>Parent: <strong className="text-neutral-300">{parent.name}</strong></span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span>Head: <strong className="text-neutral-300">{manager ? manager.name : "Unassigned"}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Create Department Form Card */}
          {showDeptForm && (
            <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
                <h4 className="font-semibold text-white text-sm">New Department</h4>
                <button onClick={() => setShowDeptForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitDept((data) => addDeptMutation.mutate(data))} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Dept Name</label>
                  <input
                    type="text"
                    {...registerDept("name")}
                    placeholder="Engineering, Finance..."
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                  />
                  {deptErrors.name && <p className="text-3xs text-red-400">{deptErrors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Parent Department</label>
                  <select
                    {...registerDept("parentId")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  >
                    <option value="">None (Top Level)</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Department Head</label>
                  <select
                    {...registerDept("headId")}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={addDeptMutation.isPending}
                  className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2 text-xs font-semibold transition disabled:opacity-50"
                >
                  Create Department
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab: Categories */}
      {activeTab === "categories" && (
        <div className="grid gap-6 md:grid-cols-3 items-start">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm uppercase tracking-wider text-[var(--af-muted)]">Asset Categories</h3>
              <button
                onClick={() => setShowCatForm(!showCatForm)}
                className="flex items-center gap-2 rounded-lg bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] px-4.5 py-2 text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 p-5 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white">{cat.name}</span>
                    <Settings className="h-4 w-4 text-[var(--af-muted)] hover:text-white cursor-pointer" />
                  </div>
                  <p className="text-xs text-[var(--af-muted)]">{cat.description || "No description provided."}</p>
                  {cat.optionalFields && Object.keys(cat.optionalFields).length > 0 && (
                    <div className="border-t border-[var(--af-border)] pt-2.5 space-y-1.5">
                      <span className="text-3xs uppercase font-bold text-[var(--af-muted)]">Optional Attributes</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(cat.optionalFields).map(([k, v]: [string, any]) => (
                          <span key={k} className="rounded bg-[var(--af-surface-elevated)] px-2 py-0.5 text-3xs text-neutral-300 border border-[var(--af-border)]">
                            {k}: <strong className="text-[var(--af-accent)]">{v}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Create Category Form Card */}
          {showCatForm && (
            <div className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
                <h4 className="font-semibold text-white text-sm">New Category</h4>
                <button onClick={() => setShowCatForm(false)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitCat((data) => addCatMutation.mutate(data))} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Category Name</label>
                  <input
                    type="text"
                    {...registerCat("name")}
                    placeholder="Laptops, Vehicles..."
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)]"
                  />
                  {catErrors.name && <p className="text-3xs text-red-400">{catErrors.name.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Description</label>
                  <textarea
                    {...registerCat("description")}
                    placeholder="Details about hardware spec..."
                    rows={2}
                    className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-[var(--af-accent)] resize-none"
                  />
                </div>

                {/* Optional Custom Fields spec */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Custom Metadata Fields</label>
                    <button
                      type="button"
                      onClick={addOptField}
                      className="text-3xs text-[var(--af-accent)] font-semibold hover:underline"
                    >
                      + Add Attribute
                    </button>
                  </div>
                  <div className="space-y-2">
                    {optFields.map((field, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Field name (e.g. RAM)"
                          value={field.key}
                          onChange={(e) => {
                            const copy = [...optFields];
                            copy[index].key = e.target.value;
                            setOptFields(copy);
                          }}
                          className="flex-1 rounded border border-[var(--af-border)] bg-[var(--af-bg)] px-2 py-1 text-2xs text-white outline-none"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const copy = [...optFields];
                            copy[index].type = e.target.value;
                            setOptFields(copy);
                          }}
                          className="rounded border border-[var(--af-border)] bg-[var(--af-bg)] px-2 py-1 text-2xs text-white outline-none"
                        >
                          <option value="string">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Yes/No</option>
                        </select>
                        <button type="button" onClick={() => removeOptField(index)} className="text-red-400 hover:text-red-300">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={addCatMutation.isPending}
                  className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2 text-xs font-semibold transition disabled:opacity-50"
                >
                  Create Category
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab: Employees & Role Promotion */}
      {activeTab === "employees" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div className="flex gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--af-muted)]" />
                <input
                  type="text"
                  placeholder="Search directory..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 py-2 pl-9 pr-4 text-xs text-white placeholder-neutral-500 outline-none focus:border-[var(--af-accent)]"
                />
              </div>
              <select
                value={employeeRoleFilter}
                onChange={(e) => setEmployeeRoleFilter(e.target.value)}
                className="rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)]/60 px-3 text-xs text-white outline-none"
              >
                <option value="">All Roles</option>
                <option value={Role.Admin}>Admin</option>
                <option value={Role.AssetManager}>AssetManager</option>
                <option value={Role.DepartmentHead}>DepartmentHead</option>
                <option value={Role.Employee}>Employee</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)]/40">
            <table className="w-full border-collapse text-left text-xs text-[var(--af-text)]">
              <thead>
                <tr className="border-b border-[var(--af-border)] bg-[var(--af-surface)]/80 text-[var(--af-muted)] uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Role Clearance</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--af-border)] bg-transparent">
                {employees.map((emp: any) => {
                  const dept = departments.find(d => d.id === emp.departmentId);
                  return (
                    <tr key={emp.id} className="hover:bg-[var(--af-surface)]/20 transition">
                      <td className="px-6 py-4 font-semibold text-white">{emp.name}</td>
                      <td className="px-6 py-4 text-[var(--af-muted)] font-mono">{emp.email}</td>
                      <td className="px-6 py-4">{dept ? dept.name : "-"}</td>
                      <td className="px-6 py-4">
                        <span className="rounded bg-[var(--af-surface-elevated)] px-2.5 py-1 text-2xs font-mono font-semibold text-neutral-200 border border-[var(--af-border)]">
                          {emp.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 text-2xs font-semibold ${
                          emp.status === EntityStatus.Active ? "text-emerald-400" : "text-neutral-400"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            emp.status === EntityStatus.Active ? "bg-emerald-400" : "bg-neutral-400"
                          }`}></span>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setPromotingEmployee(emp)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--af-border)] bg-[var(--af-surface-elevated)]/60 px-3 py-1.5 text-2xs text-[var(--af-accent)] hover:bg-[var(--af-surface-elevated)] transition cursor-pointer"
                        >
                          <Award className="h-3 w-3" />
                          Adjust Role
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Promotion / Change Modal */}
      {promotingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--af-border)] bg-[var(--af-surface)] p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--af-border)] pb-3">
              <h4 className="font-[family-name:var(--font-display)] text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-[var(--af-warning)]" />
                Adjust Role Clearance
              </h4>
              <button onClick={() => setPromotingEmployee(null)} className="text-[var(--af-muted)] hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-xs text-[var(--af-muted)]">
              Modifying clearance level for <strong className="text-white">{promotingEmployee.name}</strong> ({promotingEmployee.email})
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const role = formData.get("role") as Role;
                const departmentId = formData.get("departmentId") as string;
                promoteMutation.mutate({
                  employeeId: promotingEmployee.id,
                  role,
                  departmentId
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Assigned Role</label>
                <select
                  name="role"
                  defaultValue={promotingEmployee.role}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value={Role.Employee}>Employee (Standard clearance)</option>
                  <option value={Role.DepartmentHead}>DepartmentHead (Dept scope)</option>
                  <option value={Role.AssetManager}>AssetManager (Manage & Allocate)</option>
                  <option value={Role.Admin}>Admin (Full clearance)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-2xs font-bold uppercase tracking-wider text-[var(--af-muted)]">Team Department</label>
                <select
                  name="departmentId"
                  defaultValue={promotingEmployee.departmentId || ""}
                  className="w-full rounded-md border border-[var(--af-border)] bg-[var(--af-bg)] px-3 py-2.5 text-xs text-white outline-none focus:border-[var(--af-accent)]"
                >
                  <option value="">Unassigned</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={promoteMutation.isPending}
                className="w-full rounded-md bg-[var(--af-accent)] hover:bg-[var(--af-accent-hover)] text-[#042f2e] py-2.5 text-xs font-semibold transition disabled:opacity-50"
              >
                {promoteMutation.isPending ? "Updating clearance..." : "Confirm Role Clearance"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
