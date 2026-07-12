import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import type { PaginatedResponse, Role, EntityStatus } from "@assetflow/shared";

// ==========================================
// CURRENT USER
// ==========================================

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<any>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

// ==========================================
// DEPARTMENTS
// ==========================================

export function useDepartments(params: { page?: number; pageSize?: number; q?: string; status?: string }) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));
  if (params.q) queryParams.set("q", params.q);
  if (params.status) queryParams.set("status", params.status);

  return useQuery({
    queryKey: ["org", "departments", params],
    queryFn: () => apiFetch<PaginatedResponse<any>>(`/org/departments?${queryParams.toString()}`),
  });
}

export function useDepartment(id: string | null) {
  return useQuery({
    queryKey: ["org", "departments", id],
    queryFn: () => apiFetch<any>(`/org/departments/${id}`),
    enabled: !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string | null; headId?: string | null; status?: string }) =>
      apiFetch<any>("/org/departments", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "departments"] });
    },
  });
}

export function useUpdateDepartment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; parentId?: string | null; headId?: string | null; status?: string }) =>
      apiFetch<any>(`/org/departments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "departments"] });
    },
  });
}

export function useDeactivateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/org/departments/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "departments"] });
    },
  });
}

// ==========================================
// ASSET CATEGORIES
// ==========================================

export function useCategories(params: { page?: number; pageSize?: number; q?: string }) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));
  if (params.q) queryParams.set("q", params.q);

  return useQuery({
    queryKey: ["org", "categories", params],
    queryFn: () => apiFetch<PaginatedResponse<any>>(`/org/categories?${queryParams.toString()}`),
  });
}

export function useCategory(id: string | null) {
  return useQuery({
    queryKey: ["org", "categories", id],
    queryFn: () => apiFetch<any>(`/org/categories/${id}`),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; optionalFields?: Record<string, any> }) =>
      apiFetch<any>("/org/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "categories"] });
    },
  });
}

export function useUpdateCategory(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; description?: string; optionalFields?: Record<string, any> }) =>
      apiFetch<any>(`/org/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "categories"] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<any>(`/org/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "categories"] });
    },
  });
}

// ==========================================
// EMPLOYEES
// ==========================================

export function useEmployees(params: { page?: number; pageSize?: number; q?: string; departmentId?: string; role?: string; status?: string }) {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.set("page", String(params.page));
  if (params.pageSize) queryParams.set("pageSize", String(params.pageSize));
  if (params.q) queryParams.set("q", params.q);
  if (params.departmentId) queryParams.set("departmentId", params.departmentId);
  if (params.role) queryParams.set("role", params.role);
  if (params.status) queryParams.set("status", params.status);

  return useQuery({
    queryKey: ["org", "employees", params],
    queryFn: () => apiFetch<PaginatedResponse<any>>(`/org/employees?${queryParams.toString()}`),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ["org", "employees", id],
    queryFn: () => apiFetch<any>(`/org/employees/${id}`),
    enabled: !!id,
  });
}

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; departmentId?: string | null; status?: string }) =>
      apiFetch<any>(`/org/employees/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "employees"] });
    },
  });
}

export function usePromoteEmployee(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: Role) =>
      apiFetch<any>(`/org/employees/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", "employees"] });
    },
  });
}
