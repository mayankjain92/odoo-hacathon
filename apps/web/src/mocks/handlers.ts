import { http, HttpResponse } from "msw";
import type { PaginatedResponse } from "@assetflow/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// Frozen-contract stub. Frontend track adds real handlers per module here.
// Lists must return { data, meta } (see @assetflow/shared PaginatedResponse).
const emptyPage: PaginatedResponse<never> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

// In-memory mock database
const mockDepartments = [
  {
    id: "seed-dept-engineering",
    name: "Engineering",
    parentId: null as string | null,
    headId: "user-2",
    status: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parent: null as { id: string; name: string } | null,
    head: { id: "user-2", name: "Jane Head", email: "jane@assetflow.local" } as { id: string; name: string; email: string } | null,
    _count: { users: 2, assets: 5 },
  },
  {
    id: "dept-2",
    name: "Operations",
    parentId: null as string | null,
    headId: null as string | null,
    status: "Active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    parent: null as { id: string; name: string } | null,
    head: null as { id: string; name: string; email: string } | null,
    _count: { users: 1, assets: 10 },
  },
];

const mockCategories = [
  {
    id: "cat-1",
    name: "Electronics",
    description: "Laptops, phones, peripherals",
    optionalFields: { warrantyMonths: 12 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { assets: 15 },
  },
  {
    id: "cat-2",
    name: "Furniture",
    description: "Desks, chairs, cabinets",
    optionalFields: null as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { assets: 3 },
  },
];

const mockEmployees = [
  {
    id: "user-1",
    name: "System Admin",
    email: "admin@assetflow.local",
    role: "Admin",
    status: "Active",
    departmentId: "seed-dept-engineering",
    department: { id: "seed-dept-engineering", name: "Engineering" } as { id: string; name: string } | null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user-2",
    name: "Jane Head",
    email: "jane@assetflow.local",
    role: "DepartmentHead",
    status: "Active",
    departmentId: "seed-dept-engineering",
    department: { id: "seed-dept-engineering", name: "Engineering" } as { id: string; name: string } | null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "user-3",
    name: "John Employee",
    email: "john@assetflow.local",
    role: "Employee",
    status: "Active",
    departmentId: "dept-2",
    department: { id: "dept-2", name: "Operations" } as { id: string; name: string } | null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const handlers = [
  http.get(`${API_URL}/health`, () =>
    HttpResponse.json({ status: "ok", service: "assetflow-api" }),
  ),
  // Example paginated list — copy this shape per module.
  http.get(`${API_URL}/assets`, () => HttpResponse.json(emptyPage)),

  // ==========================================
  // DEPARTMENTS
  // ==========================================
  http.get(`${API_URL}/org/departments`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();
    const status = url.searchParams.get("status");

    let filtered = [...mockDepartments];
    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }
    if (q) {
      filtered = filtered.filter((d) => d.name.toLowerCase().includes(q));
    }

    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "20");
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),

  http.post(`${API_URL}/org/departments`, async ({ request }) => {
    const body = (await request.json()) as any;
    const id = `dept-${Math.random().toString(36).substr(2, 9)}`;
    const head = body.headId ? mockEmployees.find((e) => e.id === body.headId) : null;
    const parent = body.parentId ? mockDepartments.find((d) => d.id === body.parentId) : null;

    const newDept = {
      id,
      name: body.name,
      parentId: body.parentId || null,
      headId: body.headId || null,
      status: body.status || "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parent: parent ? { id: parent.id, name: parent.name } : null,
      head: head ? { id: head.id, name: head.name, email: head.email } : null,
      _count: { users: 0, assets: 0 },
    };

    mockDepartments.push(newDept);
    return HttpResponse.json(newDept);
  }),

  http.get(`${API_URL}/org/departments/:id`, ({ params }) => {
    const dept = mockDepartments.find((d) => d.id === params.id);
    if (!dept) {
      return new HttpResponse(null, { status: 404 });
    }
    const children = mockDepartments
      .filter((d) => d.parentId === params.id)
      .map((d) => ({ id: d.id, name: d.name, status: d.status }));

    return HttpResponse.json({
      ...dept,
      children,
    });
  }),

  http.patch(`${API_URL}/org/departments/:id`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    const idx = mockDepartments.findIndex((d) => d.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const current = mockDepartments[idx];
    const head = body.headId ? mockEmployees.find((e) => e.id === body.headId) : null;
    const parent = body.parentId ? mockDepartments.find((d) => d.id === body.parentId) : null;

    const updated = {
      ...current,
      name: body.name !== undefined ? body.name : current.name,
      parentId: body.parentId === null ? null : body.parentId || current.parentId,
      headId: body.headId === null ? null : body.headId || current.headId,
      status: body.status !== undefined ? body.status : current.status,
      updatedAt: new Date().toISOString(),
      parent: body.parentId === null ? null : parent ? { id: parent.id, name: parent.name } : current.parent,
      head: body.headId === null ? null : head ? { id: head.id, name: head.name, email: head.email } : current.head,
    };

    mockDepartments[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_URL}/org/departments/:id`, ({ params }) => {
    const idx = mockDepartments.findIndex((d) => d.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    mockDepartments[idx].status = "Inactive";
    return HttpResponse.json(mockDepartments[idx]);
  }),

  // ==========================================
  // ASSET CATEGORIES
  // ==========================================
  http.get(`${API_URL}/org/categories`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();

    let filtered = [...mockCategories];
    if (q) {
      filtered = filtered.filter(
        (c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
      );
    }

    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "20");
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),

  http.post(`${API_URL}/org/categories`, async ({ request }) => {
    const body = (await request.json()) as any;
    const id = `cat-${Math.random().toString(36).substr(2, 9)}`;

    const newCat = {
      id,
      name: body.name,
      description: body.description || null,
      optionalFields: body.optionalFields || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { assets: 0 },
    };

    mockCategories.push(newCat);
    return HttpResponse.json(newCat);
  }),

  http.get(`${API_URL}/org/categories/:id`, ({ params }) => {
    const cat = mockCategories.find((c) => c.id === params.id);
    if (!cat) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(cat);
  }),

  http.patch(`${API_URL}/org/categories/:id`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    const idx = mockCategories.findIndex((c) => c.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const current = mockCategories[idx];
    const updated = {
      ...current,
      name: body.name !== undefined ? body.name : current.name,
      description: body.description !== undefined ? body.description : current.description,
      optionalFields: body.optionalFields !== undefined ? body.optionalFields : current.optionalFields,
      updatedAt: new Date().toISOString(),
    };

    mockCategories[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_URL}/org/categories/:id`, ({ params }) => {
    const idx = mockCategories.findIndex((c) => c.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    mockCategories.splice(idx, 1);
    return HttpResponse.json({ success: true });
  }),

  // ==========================================
  // EMPLOYEES
  // ==========================================
  http.get(`${API_URL}/org/employees`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.toLowerCase();
    const departmentId = url.searchParams.get("departmentId");
    const role = url.searchParams.get("role");
    const status = url.searchParams.get("status");

    let filtered = [...mockEmployees];
    if (departmentId) {
      filtered = filtered.filter((e) => e.departmentId === departmentId);
    }
    if (role) {
      filtered = filtered.filter((e) => e.role === role);
    }
    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }
    if (q) {
      filtered = filtered.filter(
        (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q),
      );
    }

    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || "20");
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  }),

  http.get(`${API_URL}/org/employees/:id`, ({ params }) => {
    const emp = mockEmployees.find((e) => e.id === params.id);
    if (!emp) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(emp);
  }),

  http.patch(`${API_URL}/org/employees/:id`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    const idx = mockEmployees.findIndex((e) => e.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const current = mockEmployees[idx];
    const dept = body.departmentId ? mockDepartments.find((d) => d.id === body.departmentId) : null;

    const updated = {
      ...current,
      name: body.name !== undefined ? body.name : current.name,
      departmentId: body.departmentId === null ? null : body.departmentId || current.departmentId,
      status: body.status !== undefined ? body.status : current.status,
      updatedAt: new Date().toISOString(),
      department: body.departmentId === null ? null : dept ? { id: dept.id, name: dept.name } : current.department,
    };

    mockEmployees[idx] = updated;
    return HttpResponse.json(updated);
  }),

  http.put(`${API_URL}/org/employees/:id/role`, async ({ params, request }) => {
    const body = (await request.json()) as any;
    const idx = mockEmployees.findIndex((e) => e.id === params.id);
    if (idx === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockEmployees[idx].role = body.role;
    mockEmployees[idx].updatedAt = new Date().toISOString();
    return HttpResponse.json(mockEmployees[idx]);
  }),
];
