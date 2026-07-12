import { http, HttpResponse } from "msw";
import {
  AssetStatus,
  BookingStatus,
  TransferStatus,
  MaintenanceStatus,
  MaintenancePriority,
  AuditItemResult,
  AuditCycleStatus,
  EntityStatus,
  Role,
  ErrorCode
} from "@assetflow/shared";
import type { PaginatedResponse } from "@assetflow/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

// --- Types ---
interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  status: EntityStatus;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  parentId: string | null;
  headId: string | null;
  status: EntityStatus;
}

interface AssetCategory {
  id: string;
  name: string;
  description?: string;
  optionalFields?: Record<string, any>;
}

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  categoryId: string;
  serialNumber?: string;
  acquisitionDate: string;
  acquisitionCost?: number;
  condition?: string;
  location?: string;
  isSharedBookable: boolean;
  departmentId: string | null;
  status: AssetStatus;
  history: AssetHistory[];
}

interface AssetHistory {
  id: string;
  assetId: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

interface Allocation {
  id: string;
  assetId: string;
  employeeId?: string;
  departmentId?: string;
  allocatedAt: string;
  expectedReturnAt?: string | null;
  returnedAt?: string | null;
  conditionNotes?: string;
  notes?: string;
}

interface TransferRequest {
  id: string;
  assetId: string;
  fromEmployeeId: string;
  toEmployeeId?: string | null;
  toDepartmentId?: string | null;
  status: TransferStatus;
  notes?: string;
  resolvedNotes?: string;
  createdAt: string;
}

interface Booking {
  id: string;
  assetId: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  purpose?: string;
  status: BookingStatus;
}

interface MaintenanceRequest {
  id: string;
  assetId: string;
  raisedById: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedTechnician?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface AuditCycle {
  id: string;
  name: string;
  departmentId: string | null;
  location?: string;
  startsAt: string;
  endsAt: string;
  status: AuditCycleStatus;
  auditorIds: string[];
}

interface AuditItem {
  id: string;
  cycleId: string;
  assetId: string;
  result?: AuditItemResult;
  notes?: string;
  auditedById?: string;
  auditedAt?: string;
}

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  performedById: string;
  performedByName: string;
  action: string;
  details: string;
  timestamp: string;
}

// --- Initial Seed Data ---
const initialUsers: User[] = [
  { id: "usr-1", name: "Alice Admin", email: "admin@assetflow.com", role: Role.Admin, departmentId: null, status: EntityStatus.Active, createdAt: "2026-01-01T00:00:00Z" },
  { id: "usr-2", name: "Manny Manager", email: "manager@assetflow.com", role: Role.AssetManager, departmentId: null, status: EntityStatus.Active, createdAt: "2026-01-02T00:00:00Z" },
  { id: "usr-3", name: "Harvey Head", email: "head@assetflow.com", role: Role.DepartmentHead, departmentId: "dept-1", status: EntityStatus.Active, createdAt: "2026-01-03T00:00:00Z" },
  { id: "usr-4", name: "Emily Employee", email: "employee@assetflow.com", role: Role.Employee, departmentId: "dept-1", status: EntityStatus.Active, createdAt: "2026-01-04T00:00:00Z" },
];

const initialDepartments: Department[] = [
  { id: "dept-1", name: "IT & Engineering", parentId: null, headId: "usr-3", status: EntityStatus.Active },
  { id: "dept-2", name: "Finance & Accounting", parentId: null, headId: null, status: EntityStatus.Active },
  { id: "dept-3", name: "Operations & HR", parentId: null, headId: null, status: EntityStatus.Active },
];

const initialCategories: AssetCategory[] = [
  { id: "cat-1", name: "Laptops & Computers", description: "Standard issue developer/admin laptops", optionalFields: { ram: "16GB", storage: "512GB SSD" } },
  { id: "cat-2", name: "Monitors & Screens", description: "Desktop screens and conference monitors", optionalFields: { size: "27\"", resolution: "4K" } },
  { id: "cat-3", name: "Vehicles & Transport", description: "Company cars and logistics vans", optionalFields: { fuel: "Electric", range: "300 miles" } },
  { id: "cat-4", name: "Office Furniture", description: "Chairs, desks, and ergonomic gear", optionalFields: { adjustable: true } },
];

const initialAssets: Asset[] = [
  {
    id: "ast-1",
    assetTag: "AF-1001",
    name: "MacBook Pro 16\" (M3 Max)",
    categoryId: "cat-1",
    serialNumber: "C02FXXXXXX",
    acquisitionDate: "2026-01-10",
    acquisitionCost: 3499,
    condition: "Excellent",
    location: "IT Room 3A",
    isSharedBookable: false,
    departmentId: "dept-1",
    status: AssetStatus.Allocated,
    history: [
      { id: "h-1", assetId: "ast-1", action: "Register", performedBy: "Alice Admin", details: "Asset registered in system", timestamp: "2026-01-10T10:00:00Z" },
      { id: "h-2", assetId: "ast-1", action: "Allocate", performedBy: "Manny Manager", details: "Allocated to Emily Employee", timestamp: "2026-01-12T14:30:00Z" },
    ]
  },
  {
    id: "ast-2",
    assetTag: "AF-1002",
    name: "Dell UltraSharp 27\" Hub Monitor",
    categoryId: "cat-2",
    serialNumber: "CN-0GXXXX",
    acquisitionDate: "2026-02-15",
    acquisitionCost: 599,
    condition: "Good",
    location: "Office Area B",
    isSharedBookable: true,
    departmentId: "dept-1",
    status: AssetStatus.Available,
    history: [
      { id: "h-3", assetId: "ast-2", action: "Register", performedBy: "Alice Admin", details: "Asset registered in system", timestamp: "2026-02-15T09:15:00Z" },
    ]
  },
  {
    id: "ast-3",
    assetTag: "AF-1003",
    name: "Tesla Model Y (Long Range)",
    categoryId: "cat-3",
    serialNumber: "5YJXXXXX",
    acquisitionDate: "2026-03-01",
    acquisitionCost: 48990,
    condition: "Excellent",
    location: "Parking Space 12",
    isSharedBookable: true,
    departmentId: "dept-3",
    status: AssetStatus.Reserved,
    history: [
      { id: "h-4", assetId: "ast-3", action: "Register", performedBy: "Alice Admin", details: "Asset registered in system", timestamp: "2026-03-01T08:00:00Z" },
    ]
  },
  {
    id: "ast-4",
    assetTag: "AF-1004",
    name: "Herman Miller Aeron Chair",
    categoryId: "cat-4",
    serialNumber: "HM-AERON-99",
    acquisitionDate: "2026-01-20",
    acquisitionCost: 1200,
    condition: "Good",
    location: "Executive Suite 4",
    isSharedBookable: false,
    departmentId: "dept-2",
    status: AssetStatus.Available,
    history: [
      { id: "h-5", assetId: "ast-4", action: "Register", performedBy: "Alice Admin", details: "Asset registered in system", timestamp: "2026-01-20T11:00:00Z" },
    ]
  },
  {
    id: "ast-5",
    assetTag: "AF-1005",
    name: "Lenovo ThinkPad X1 Carbon Gen 11",
    categoryId: "cat-1",
    serialNumber: "PF-4XXXXX",
    acquisitionDate: "2026-02-28",
    acquisitionCost: 1899,
    condition: "Damaged Screen",
    location: "IT Repair Bench",
    isSharedBookable: false,
    departmentId: "dept-1",
    status: AssetStatus.UnderMaintenance,
    history: [
      { id: "h-6", assetId: "ast-5", action: "Register", performedBy: "Manny Manager", details: "Asset registered in system", timestamp: "2026-02-28T16:00:00Z" },
      { id: "h-7", assetId: "ast-5", action: "Maintenance Report", performedBy: "Emily Employee", details: "Reported flickering screen issues", timestamp: "2026-03-05T09:00:00Z" },
    ]
  }
];

const initialAllocations: Allocation[] = [
  {
    id: "alc-1",
    assetId: "ast-1",
    employeeId: "usr-4",
    allocatedAt: "2026-01-12T14:30:00Z",
    expectedReturnAt: "2026-06-30T17:00:00Z", // Overdue allocation since local date is 2026-07-12
    returnedAt: null,
    notes: "Laptop issued for remote engineering work."
  }
];

const initialBookings: Booking[] = [
  { id: "bkg-1", assetId: "ast-2", employeeId: "usr-3", startsAt: "2026-07-15T09:00:00Z", endsAt: "2026-07-15T12:00:00Z", purpose: "Design review session", status: BookingStatus.Upcoming },
  { id: "bkg-2", assetId: "ast-3", employeeId: "usr-4", startsAt: "2026-07-13T08:00:00Z", endsAt: "2026-07-13T18:00:00Z", purpose: "Client visit in logistics area", status: BookingStatus.Upcoming },
];

const initialMaintenanceRequests: MaintenanceRequest[] = [
  {
    id: "maint-1",
    assetId: "ast-5",
    raisedById: "usr-4",
    description: "Display has severe flicker and vertical green lines on startup.",
    priority: MaintenancePriority.High,
    status: MaintenanceStatus.InProgress,
    assignedTechnician: "T-Tech Solutions",
    createdAt: "2026-03-05T09:00:00Z"
  }
];

const initialAudits: AuditCycle[] = [
  { id: "aud-1", name: "Q2 Hardware Reconciliation", departmentId: "dept-1", location: "IT Office", startsAt: "2026-06-01T08:00:00Z", endsAt: "2026-06-25T17:00:00Z", status: AuditCycleStatus.Closed, auditorIds: ["usr-2"] },
  { id: "aud-2", name: "General Office Equipment Audit", departmentId: null, location: "Main Headquarters", startsAt: "2026-07-05T08:00:00Z", endsAt: "2026-07-20T17:00:00Z", status: AuditCycleStatus.InProgress, auditorIds: ["usr-1", "usr-2"] },
];

const initialAuditItems: AuditItem[] = [
  { id: "ai-1", cycleId: "aud-2", assetId: "ast-1", result: undefined, notes: "" },
  { id: "ai-2", cycleId: "aud-2", assetId: "ast-2", result: AuditItemResult.Verified, auditedById: "usr-2", auditedAt: "2026-07-06T11:00:00Z", notes: "Verified in rack room" },
  { id: "ai-3", cycleId: "aud-2", assetId: "ast-4", result: undefined, notes: "" },
  { id: "ai-4", cycleId: "aud-2", assetId: "ast-5", result: AuditItemResult.Damaged, auditedById: "usr-1", auditedAt: "2026-07-07T14:00:00Z", notes: "Screen damage confirmed, awaiting repairs" },
];

const initialTransfers: TransferRequest[] = [];

const initialNotifications: Notification[] = [
  { id: "not-1", userId: "usr-4", title: "Allocation Overdue", message: "Your allocation for MacBook Pro 16\" (AF-1001) was due on June 30, 2026. Please return it or contact management.", read: false, createdAt: "2026-07-01T08:00:00Z" },
  { id: "not-2", userId: "usr-1", title: "Pending Promotion", message: "Audit cycle General Office Equipment Audit has discrepancies to review.", read: false, createdAt: "2026-07-07T15:00:00Z" }
];

const initialActivityLogs: ActivityLog[] = [
  { id: "log-1", performedById: "usr-1", performedByName: "Alice Admin", action: "Register", details: "Registered asset AF-1001 (MacBook Pro)", timestamp: "2026-01-10T10:00:00Z" },
  { id: "log-2", performedById: "usr-2", performedByName: "Manny Manager", action: "Allocate", details: "Allocated asset AF-1001 to Emily Employee", timestamp: "2026-01-12T14:30:00Z" },
];

// --- Persistent State Manager ---
class DB {
  private static get<T>(key: string, seed: T[]): T[] {
    if (typeof window === "undefined") return seed;
    const val = localStorage.getItem(`af_db_${key}`);
    if (!val) {
      localStorage.setItem(`af_db_${key}`, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(val);
  }

  private static set<T>(key: string, data: T[]) {
    if (typeof window !== "undefined") {
      localStorage.setItem(`af_db_${key}`, JSON.stringify(data));
    }
  }

  static get users() { return this.get("users", initialUsers); }
  static set users(v) { this.set("users", v); }

  static get departments() { return this.get("departments", initialDepartments); }
  static set departments(v) { this.set("departments", v); }

  static get categories() { return this.get("categories", initialCategories); }
  static set categories(v) { this.set("categories", v); }

  static get assets() { return this.get("assets", initialAssets); }
  static set assets(v) { this.set("assets", v); }

  static get allocations() { return this.get("allocations", initialAllocations); }
  static set allocations(v) { this.set("allocations", v); }

  static get bookings() { return this.get("bookings", initialBookings); }
  static set bookings(v) { this.set("bookings", v); }

  static get maintenance() { return this.get("maintenance", initialMaintenanceRequests); }
  static set maintenance(v) { this.set("maintenance", v); }

  static get audits() { return this.get("audits", initialAudits); }
  static set audits(v) { this.set("audits", v); }

  static get auditItems() { return this.get("auditItems", initialAuditItems); }
  static set auditItems(v) { this.set("auditItems", v); }

  static get transfers() { return this.get("transfers", initialTransfers); }
  static set transfers(v) { this.set("transfers", v); }

  static get notifications() { return this.get("notifications", initialNotifications); }
  static set notifications(v) { this.set("notifications", v); }

  static get activityLogs() { return this.get("activityLogs", initialActivityLogs); }
  static set activityLogs(v) { this.set("activityLogs", v); }

  // Session user storage (simple cookie/localStorage simulator)
  static getSessionUser(): User | null {
    if (typeof window === "undefined") return initialUsers[0];
    const usrId = localStorage.getItem("af_session_userid");
    if (!usrId) {
      // Default to Emily Employee or Admin to make testing convenient, let's pick Admin
      localStorage.setItem("af_session_userid", "usr-1");
      return this.users.find(u => u.id === "usr-1") || null;
    }
    return this.users.find(u => u.id === usrId) || null;
  }

  static setSessionUser(userId: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("af_session_userid", userId);
    }
  }

  static logActivity(userId: string, action: string, details: string) {
    const user = this.users.find(u => u.id === userId);
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      performedById: userId,
      performedByName: user ? user.name : "System",
      action,
      details,
      timestamp: new Date().toISOString()
    };
    this.activityLogs = [newLog, ...this.activityLogs];
  }
}

// --- Pagination helper ---
function paginate<T>(items: T[], page = 1, pageSize = 20, filterFn?: (item: T) => boolean): PaginatedResponse<T> {
  const filtered = filterFn ? items.filter(filterFn) : items;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filtered.slice(start, end);
  return {
    data,
    meta: { page, pageSize, total, totalPages }
  };
}

// --- Handlers ---
export const handlers = [
  // --- Health ---
  http.get(`${API_URL}/health`, () => {
    return HttpResponse.json({ status: "ok", service: "assetflow-api" });
  }),

  // --- Auth ---
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as any;
    const user = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return HttpResponse.json(
        { statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Invalid email or password" },
        { status: 401 }
      );
    }
    DB.setSessionUser(user.id);
    DB.logActivity(user.id, "Login", "Logged into system");
    return HttpResponse.json({ user, token: "mock-jwt-token" });
  }),

  http.post(`${API_URL}/auth/signup`, async ({ request }) => {
    const { name, email, password } = (await request.json()) as any;
    if (DB.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return HttpResponse.json(
        { statusCode: 400, code: ErrorCode.VALIDATION_ERROR, message: "Email already registered" },
        { status: 400 }
      );
    }
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: Role.Employee, // Signups are locked to employee only
      departmentId: null,
      status: EntityStatus.Active,
      createdAt: new Date().toISOString()
    };
    DB.users = [...DB.users, newUser];
    DB.setSessionUser(newUser.id);
    DB.logActivity(newUser.id, "Signup", "Created new employee account");
    return HttpResponse.json({ user: newUser, token: "mock-jwt-token" });
  }),

  http.get(`${API_URL}/auth/me`, () => {
    const user = DB.getSessionUser();
    if (!user) {
      return HttpResponse.json(
        { statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Not logged in" },
        { status: 401 }
      );
    }
    return HttpResponse.json(user);
  }),

  http.post(`${API_URL}/auth/logout`, () => {
    const user = DB.getSessionUser();
    if (user) {
      DB.logActivity(user.id, "Logout", "Logged out of system");
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("af_session_userid");
    }
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API_URL}/auth/forgot-password`, async ({ request }) => {
    const { email } = (await request.json()) as any;
    const user = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return HttpResponse.json(
        { statusCode: 404, code: ErrorCode.NOT_FOUND, message: "No account found with this email" },
        { status: 404 }
      );
    }
    return HttpResponse.json({ message: "Password reset instructions sent to email" });
  }),

  // --- Org (Departments, Categories, Employees) ---
  http.get(`${API_URL}/org/departments`, () => {
    return HttpResponse.json({ data: DB.departments });
  }),

  http.post(`${API_URL}/org/departments`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || sessionUser.role !== Role.Admin) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Admin role required" }, { status: 403 });
    }
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: body.name,
      parentId: body.parentId || null,
      headId: body.headId || null,
      status: body.status || EntityStatus.Active
    };
    DB.departments = [...DB.departments, newDept];
    DB.logActivity(sessionUser.id, "Create Department", `Created department: ${body.name}`);
    return HttpResponse.json(newDept);
  }),

  http.get(`${API_URL}/org/categories`, () => {
    return HttpResponse.json({ data: DB.categories });
  }),

  http.post(`${API_URL}/org/categories`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }
    const newCat: AssetCategory = {
      id: `cat-${Date.now()}`,
      name: body.name,
      description: body.description,
      optionalFields: body.optionalFields || {}
    };
    DB.categories = [...DB.categories, newCat];
    DB.logActivity(sessionUser.id, "Create Category", `Created category: ${body.name}`);
    return HttpResponse.json(newCat);
  }),

  http.get(`${API_URL}/org/employees`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const role = url.searchParams.get("role") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const employees = DB.users;
    const res = paginate(employees, page, pageSize, (e) => {
      const matchQ = q ? e.name.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase()) : true;
      const matchRole = role ? e.role === role : true;
      return matchQ && matchRole;
    });
    return HttpResponse.json(res);
  }),

  http.patch(`${API_URL}/org/employees/:id/role`, async ({ params, request }) => {
    const { id } = params;
    const { role, departmentId } = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || sessionUser.role !== Role.Admin) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Admin role required" }, { status: 403 });
    }
    let targetUser: User | undefined;
    DB.users = DB.users.map(u => {
      if (u.id === id) {
        targetUser = { ...u, role, departmentId: departmentId || u.departmentId };
        return targetUser;
      }
      return u;
    });

    if (!targetUser) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Employee not found" }, { status: 404 });
    }

    DB.logActivity(sessionUser.id, "Promote Role", `Promoted employee ${targetUser.name} to ${role}`);
    return HttpResponse.json(targetUser);
  }),

  // --- Assets ---
  http.get(`${API_URL}/assets`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";
    const categoryId = url.searchParams.get("categoryId") || "";
    const status = url.searchParams.get("status") || "";
    const bookable = url.searchParams.get("isSharedBookable");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "10");

    const filtered = DB.assets.filter(a => {
      const matchQ = q ? a.name.toLowerCase().includes(q.toLowerCase()) || a.assetTag.toLowerCase().includes(q.toLowerCase()) || (a.serialNumber || "").toLowerCase().includes(q.toLowerCase()) : true;
      const matchCat = categoryId ? a.categoryId === categoryId : true;
      const matchStatus = status ? a.status === status : true;
      const matchBookable = bookable !== null && bookable !== undefined ? a.isSharedBookable === (bookable === "true") : true;
      return matchQ && matchCat && matchStatus && matchBookable;
    });

    return HttpResponse.json(paginate(filtered, page, pageSize));
  }),

  http.get(`${API_URL}/assets/:id`, ({ params }) => {
    const { id } = params;
    const asset = DB.assets.find(a => a.id === id || a.assetTag === id);
    if (!asset) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Asset not found" }, { status: 404 });
    }
    return HttpResponse.json(asset);
  }),

  http.post(`${API_URL}/assets`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }

    const nextNumber = DB.assets.length + 1001;
    const newTag = `AF-${nextNumber}`;
    const newAsset: Asset = {
      id: `ast-${Date.now()}`,
      assetTag: newTag,
      name: body.name,
      categoryId: body.categoryId,
      serialNumber: body.serialNumber,
      acquisitionDate: body.acquisitionDate,
      acquisitionCost: body.acquisitionCost,
      condition: body.condition || "New",
      location: body.location || "Central Storage",
      isSharedBookable: body.isSharedBookable || false,
      departmentId: body.departmentId || null,
      status: AssetStatus.Available,
      history: [
        {
          id: `h-${Date.now()}`,
          assetId: `ast-${Date.now()}`,
          action: "Register",
          performedBy: sessionUser.name,
          details: `Registered as Available. Auto Tag: ${newTag}`,
          timestamp: new Date().toISOString()
        }
      ]
    };
    newAsset.history[0].assetId = newAsset.id; // fix ID
    DB.assets = [...DB.assets, newAsset];
    DB.logActivity(sessionUser.id, "Register Asset", `Registered new asset ${body.name} (${newTag})`);
    return HttpResponse.json(newAsset);
  }),

  // --- Allocations & Transfers ---
  http.get(`${API_URL}/allocations`, () => {
    return HttpResponse.json({ data: DB.allocations });
  }),

  http.post(`${API_URL}/allocations`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager && sessionUser.role !== Role.DepartmentHead)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Manager privileges required" }, { status: 403 });
    }

    const asset = DB.assets.find(a => a.id === body.assetId);
    if (!asset) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Asset not found" }, { status: 404 });
    }

    // Allocate conflict rule check
    if (asset.status !== AssetStatus.Available) {
      const activeAllocation = DB.allocations.find(al => al.assetId === asset.id && !al.returnedAt);
      let holderDetails = "someone else";
      let holderId = "";
      if (activeAllocation) {
        if (activeAllocation.employeeId) {
          const user = DB.users.find(u => u.id === activeAllocation.employeeId);
          holderDetails = user ? `${user.name} (${user.email})` : "employee";
          holderId = activeAllocation.employeeId;
        } else if (activeAllocation.departmentId) {
          const dept = DB.departments.find(d => d.id === activeAllocation.departmentId);
          holderDetails = dept ? `Department: ${dept.name}` : "department";
        }
      }
      return HttpResponse.json({
        statusCode: 409,
        code: ErrorCode.ASSET_ALREADY_ALLOCATED,
        message: `Asset ${asset.assetTag} is already held by ${holderDetails}.`,
        details: {
          assetId: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          holderName: holderDetails,
          holderId
        }
      }, { status: 409 });
    }

    const newAllocation: Allocation = {
      id: `alc-${Date.now()}`,
      assetId: body.assetId,
      employeeId: body.employeeId || undefined,
      departmentId: body.departmentId || undefined,
      allocatedAt: new Date().toISOString(),
      expectedReturnAt: body.expectedReturnAt || null,
      returnedAt: null,
      notes: body.notes
    };

    // Update asset
    DB.assets = DB.assets.map(a => {
      if (a.id === asset.id) {
        const hist: AssetHistory = {
          id: `h-${Date.now()}`,
          assetId: a.id,
          action: "Allocate",
          performedBy: sessionUser.name,
          details: `Allocated to ${body.employeeId ? "employee usr:" + body.employeeId : "department:" + body.departmentId}`,
          timestamp: new Date().toISOString()
        };
        return { ...a, status: AssetStatus.Allocated, departmentId: body.departmentId || a.departmentId, history: [...a.history, hist] };
      }
      return a;
    });

    DB.allocations = [...DB.allocations, newAllocation];

    // Log Activity
    const allocationTargetName = body.employeeId
      ? (DB.users.find(u => u.id === body.employeeId)?.name || "Employee")
      : (DB.departments.find(d => d.id === body.departmentId)?.name || "Department");
    DB.logActivity(sessionUser.id, "Allocate Asset", `Allocated asset ${asset.assetTag} to ${allocationTargetName}`);

    // Create Notification for employee
    if (body.employeeId) {
      const newNot: Notification = {
        id: `not-${Date.now()}`,
        userId: body.employeeId,
        title: "Asset Allocated",
        message: `Asset ${asset.name} (${asset.assetTag}) has been allocated to you. Expected return: ${body.expectedReturnAt ? new Date(body.expectedReturnAt).toLocaleDateString() : "Indefinite"}.`,
        read: false,
        createdAt: new Date().toISOString()
      };
      DB.notifications = [...DB.notifications, newNot];
    }

    return HttpResponse.json(newAllocation);
  }),

  http.post(`${API_URL}/allocations/:id/return`, async ({ params, request }) => {
    const { id } = params;
    const { conditionNotes } = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();

    const allocationIndex = DB.allocations.findIndex(al => al.id === id);
    if (allocationIndex === -1) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Allocation not found" }, { status: 404 });
    }

    const allocation = DB.allocations[allocationIndex];
    const asset = DB.assets.find(a => a.id === allocation.assetId);

    const updatedAllocation = {
      ...allocation,
      returnedAt: new Date().toISOString(),
      conditionNotes
    };

    DB.allocations = DB.allocations.map((al, idx) => idx === allocationIndex ? updatedAllocation : al);

    if (asset) {
      DB.assets = DB.assets.map(a => {
        if (a.id === asset.id) {
          const hist: AssetHistory = {
            id: `h-${Date.now()}`,
            assetId: a.id,
            action: "Return",
            performedBy: sessionUser?.name || "System",
            details: `Returned with notes: ${conditionNotes || "None"}`,
            timestamp: new Date().toISOString()
          };
          return { ...a, status: AssetStatus.Available, history: [...a.history, hist] };
        }
        return a;
      });
      if (sessionUser) {
        DB.logActivity(sessionUser.id, "Return Asset", `Returned asset ${asset.assetTag}`);
      }
    }

    return HttpResponse.json(updatedAllocation);
  }),

  // --- Transfers ---
  http.get(`${API_URL}/allocations/transfers`, () => {
    return HttpResponse.json({ data: DB.transfers });
  }),

  http.post(`${API_URL}/allocations/transfers`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser) {
      return HttpResponse.json({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Unauthenticated" }, { status: 401 });
    }

    const newTransfer: TransferRequest = {
      id: `tr-${Date.now()}`,
      assetId: body.assetId,
      fromEmployeeId: sessionUser.id,
      toEmployeeId: body.toEmployeeId || null,
      toDepartmentId: body.toDepartmentId || null,
      status: TransferStatus.Requested,
      notes: body.notes,
      createdAt: new Date().toISOString()
    };

    DB.transfers = [newTransfer, ...DB.transfers];
    const asset = DB.assets.find(a => a.id === body.assetId);
    DB.logActivity(sessionUser.id, "Request Transfer", `Requested transfer for asset ${asset ? asset.assetTag : body.assetId}`);

    // Notify administrators / department head
    const adminUsers = DB.users.filter(u => u.role === Role.Admin || u.role === Role.AssetManager);
    const notificationsToAdd = adminUsers.map(adm => ({
      id: `not-${Date.now()}-${adm.id}`,
      userId: adm.id,
      title: "Transfer Request",
      message: `Employee ${sessionUser.name} requested a transfer for asset ${asset ? asset.name : "Asset"}.`,
      read: false,
      createdAt: new Date().toISOString()
    }));
    DB.notifications = [...DB.notifications, ...notificationsToAdd];

    return HttpResponse.json(newTransfer);
  }),

  http.post(`${API_URL}/allocations/transfers/:id/resolve`, async ({ params, request }) => {
    const { id } = params;
    const { status, notes } = (await request.json()) as any; // Approved or Rejected
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager && sessionUser.role !== Role.DepartmentHead)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Manager privilege required" }, { status: 403 });
    }

    const transfer = DB.transfers.find(t => t.id === id);
    if (!transfer) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Transfer request not found" }, { status: 404 });
    }

    DB.transfers = DB.transfers.map(t => {
      if (t.id === id) {
        return { ...t, status, resolvedNotes: notes };
      }
      return t;
    });

    const asset = DB.assets.find(a => a.id === transfer.assetId);

    if (status === TransferStatus.Approved) {
      // Release old allocation
      DB.allocations = DB.allocations.map(al => {
        if (al.assetId === transfer.assetId && !al.returnedAt) {
          return { ...al, returnedAt: new Date().toISOString(), conditionNotes: "Transferred internally" };
        }
        return al;
      });

      // Create new allocation
      const newAllocation: Allocation = {
        id: `alc-${Date.now()}`,
        assetId: transfer.assetId,
        employeeId: transfer.toEmployeeId || undefined,
        departmentId: transfer.toDepartmentId || undefined,
        allocatedAt: new Date().toISOString(),
        expectedReturnAt: null,
        returnedAt: null,
        notes: `Transferred from employee ${transfer.fromEmployeeId}. Notes: ${notes || ""}`
      };
      DB.allocations = [...DB.allocations, newAllocation];

      // Update asset status
      if (asset) {
        DB.assets = DB.assets.map(a => {
          if (a.id === asset.id) {
            const hist: AssetHistory = {
              id: `h-${Date.now()}`,
              assetId: a.id,
              action: "Transfer",
              performedBy: sessionUser.name,
              details: `Transfer approved. Reallocated to ${transfer.toEmployeeId ? "employee usr:" + transfer.toEmployeeId : "department:" + transfer.toDepartmentId}`,
              timestamp: new Date().toISOString()
            };
            return { ...a, status: AssetStatus.Allocated, departmentId: transfer.toDepartmentId || a.departmentId, history: [...a.history, hist] };
          }
          return a;
        });
      }

      // Notify requester
      const newNot: Notification = {
        id: `not-${Date.now()}`,
        userId: transfer.fromEmployeeId,
        title: "Transfer Approved",
        message: `Your transfer request for asset ${asset ? asset.name : "Asset"} has been approved.`,
        read: false,
        createdAt: new Date().toISOString()
      };
      DB.notifications = [...DB.notifications, newNot];

      // Notify recipient
      if (transfer.toEmployeeId) {
        const newNot2: Notification = {
          id: `not-${Date.now()}-rec`,
          userId: transfer.toEmployeeId,
          title: "Asset Allocated (Transfer)",
          message: `Asset ${asset ? asset.name : "Asset"} has been transferred and allocated to you.`,
          read: false,
          createdAt: new Date().toISOString()
        };
        DB.notifications = [...DB.notifications, newNot2];
      }
    } else {
      // Rejection notification
      const newNot: Notification = {
        id: `not-${Date.now()}`,
        userId: transfer.fromEmployeeId,
        title: "Transfer Rejected",
        message: `Your transfer request for asset ${asset ? asset.name : "Asset"} has been rejected. Reason: ${notes || "None"}`,
        read: false,
        createdAt: new Date().toISOString()
      };
      DB.notifications = [...DB.notifications, newNot];
    }

    DB.logActivity(sessionUser.id, "Resolve Transfer", `Resolved transfer ${id} as ${status}`);
    return HttpResponse.json({ ...transfer, status, resolvedNotes: notes });
  }),

  // --- Bookings ---
  http.get(`${API_URL}/bookings`, () => {
    return HttpResponse.json({ data: DB.bookings });
  }),

  http.post(`${API_URL}/bookings`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser) {
      return HttpResponse.json({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Unauthenticated" }, { status: 401 });
    }

    const asset = DB.assets.find(a => a.id === body.assetId);
    if (!asset) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Asset not found" }, { status: 404 });
    }
    if (!asset.isSharedBookable) {
      return HttpResponse.json({ statusCode: 400, code: ErrorCode.VALIDATION_ERROR, message: "This asset is not configured for resource booking calendar." }, { status: 400 });
    }

    // Overlap validation (adjacent OK, end time of A == start time of B is allowed)
    const newStart = new Date(body.startsAt);
    const newEnd = new Date(body.endsAt);

    const isOverlap = DB.bookings.some(b => {
      if (b.assetId !== body.assetId || b.status === BookingStatus.Cancelled) return false;
      const bStart = new Date(b.startsAt);
      const bEnd = new Date(b.endsAt);
      // Overlap: A starts before B ends and A ends after B starts
      return newStart < bEnd && newEnd > bStart;
    });

    if (isOverlap) {
      return HttpResponse.json({
        statusCode: 409,
        code: ErrorCode.BOOKING_OVERLAP,
        message: "The requested booking slot overlaps with an existing reservation."
      }, { status: 409 });
    }

    const newBooking: Booking = {
      id: `bkg-${Date.now()}`,
      assetId: body.assetId,
      employeeId: sessionUser.id,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      purpose: body.purpose,
      status: BookingStatus.Upcoming
    };

    DB.bookings = [...DB.bookings, newBooking];

    // Update asset status to Reserved if it is currently Available
    if (asset.status === AssetStatus.Available) {
      DB.assets = DB.assets.map(a => {
        if (a.id === asset.id) {
          const hist: AssetHistory = {
            id: `h-${Date.now()}`,
            assetId: a.id,
            action: "Book",
            performedBy: sessionUser.name,
            details: `Booked slot: ${new Date(body.startsAt).toLocaleString()} to ${new Date(body.endsAt).toLocaleString()}`,
            timestamp: new Date().toISOString()
          };
          return { ...a, status: AssetStatus.Reserved, history: [...a.history, hist] };
        }
        return a;
      });
    }

    DB.logActivity(sessionUser.id, "Book Resource", `Booked resource ${asset.assetTag} from ${body.startsAt} to ${body.endsAt}`);
    return HttpResponse.json(newBooking);
  }),

  http.post(`${API_URL}/bookings/:id/cancel`, async ({ params }) => {
    const { id } = params;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser) {
      return HttpResponse.json({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Unauthenticated" }, { status: 401 });
    }

    const bookingIndex = DB.bookings.findIndex(b => b.id === id);
    if (bookingIndex === -1) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Booking not found" }, { status: 404 });
    }

    const booking = DB.bookings[bookingIndex];
    if (booking.employeeId !== sessionUser.id && sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Forbidden" }, { status: 403 });
    }

    DB.bookings = DB.bookings.map((b, idx) => idx === bookingIndex ? { ...b, status: BookingStatus.Cancelled } : b);

    // Reset asset status if it has no other upcoming bookings
    const asset = DB.assets.find(a => a.id === booking.assetId);
    if (asset && asset.status === AssetStatus.Reserved) {
      const activeBookings = DB.bookings.filter(b => b.assetId === asset.id && b.id !== id && b.status === BookingStatus.Upcoming);
      if (activeBookings.length === 0) {
        DB.assets = DB.assets.map(a => {
          if (a.id === asset.id) {
            const hist: AssetHistory = {
              id: `h-${Date.now()}`,
              assetId: a.id,
              action: "Cancel Booking",
              performedBy: sessionUser.name,
              details: `Cancelled booking slot`,
              timestamp: new Date().toISOString()
            };
            return { ...a, status: AssetStatus.Available, history: [...a.history, hist] };
          }
          return a;
        });
      }
    }

    DB.logActivity(sessionUser.id, "Cancel Booking", `Cancelled booking reservation ${id}`);
    return HttpResponse.json({ ...booking, status: BookingStatus.Cancelled });
  }),

  // --- Maintenance ---
  http.get(`${API_URL}/maintenance`, () => {
    return HttpResponse.json({ data: DB.maintenance });
  }),

  http.post(`${API_URL}/maintenance`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser) {
      return HttpResponse.json({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Unauthenticated" }, { status: 401 });
    }

    const asset = DB.assets.find(a => a.id === body.assetId);
    if (!asset) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Asset not found" }, { status: 404 });
    }

    const newMaint: MaintenanceRequest = {
      id: `maint-${Date.now()}`,
      assetId: body.assetId,
      raisedById: sessionUser.id,
      description: body.description,
      priority: body.priority || MaintenancePriority.Medium,
      status: MaintenanceStatus.Pending,
      createdAt: new Date().toISOString()
    };

    DB.maintenance = [...DB.maintenance, newMaint];
    DB.logActivity(sessionUser.id, "Raise Maintenance", `Reported issue for asset ${asset.assetTag}`);
    return HttpResponse.json(newMaint);
  }),

  http.post(`${API_URL}/maintenance/:id/approve`, async ({ params, request }) => {
    const { id } = params;
    const { action } = (await request.json()) as any; // Approve or Reject
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }

    const req = DB.maintenance.find(m => m.id === id);
    if (!req) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Maintenance request not found" }, { status: 404 });
    }

    const newStatus = action === "Approve" ? MaintenanceStatus.Approved : MaintenanceStatus.Rejected;

    DB.maintenance = DB.maintenance.map(m => m.id === id ? { ...m, status: newStatus } : m);

    // Hard Rule: Status transitions to UnderMaintenance only when request is approved!
    if (newStatus === MaintenanceStatus.Approved) {
      DB.assets = DB.assets.map(a => {
        if (a.id === req.assetId) {
          const hist: AssetHistory = {
            id: `h-${Date.now()}`,
            assetId: a.id,
            action: "Maintenance Approved",
            performedBy: sessionUser.name,
            details: "Transitioned status to UnderMaintenance upon approval.",
            timestamp: new Date().toISOString()
          };
          return { ...a, status: AssetStatus.UnderMaintenance, history: [...a.history, hist] };
        }
        return a;
      });
    }

    DB.logActivity(sessionUser.id, "Approve Maintenance", `Resolved maintenance approval as ${action} for ${req.id}`);
    return HttpResponse.json({ ...req, status: newStatus });
  }),

  http.post(`${API_URL}/maintenance/:id/assign`, async ({ params, request }) => {
    const { id } = params;
    const { technician } = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }

    const req = DB.maintenance.find(m => m.id === id);
    if (!req) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Maintenance request not found" }, { status: 404 });
    }

    DB.maintenance = DB.maintenance.map(m => m.id === id ? { ...m, status: MaintenanceStatus.TechnicianAssigned, assignedTechnician: technician } : m);
    DB.logActivity(sessionUser.id, "Assign Technician", `Assigned ${technician} to maintenance ${id}`);
    return HttpResponse.json({ ...req, status: MaintenanceStatus.TechnicianAssigned, assignedTechnician: technician });
  }),

  http.post(`${API_URL}/maintenance/:id/resolve`, async ({ params, request }) => {
    const { id } = params;
    const { resolutionNotes } = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();

    const req = DB.maintenance.find(m => m.id === id);
    if (!req) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Maintenance request not found" }, { status: 404 });
    }

    DB.maintenance = DB.maintenance.map(m => m.id === id ? { ...m, status: MaintenanceStatus.Resolved, resolvedAt: new Date().toISOString() } : m);

    // Hard Rule: Status transitions back to Available when resolved
    DB.assets = DB.assets.map(a => {
      if (a.id === req.assetId) {
        const hist: AssetHistory = {
          id: `h-${Date.now()}`,
          assetId: a.id,
          action: "Maintenance Resolved",
          performedBy: sessionUser?.name || "Technician",
          details: `Resolved with notes: ${resolutionNotes || "None"}`,
          timestamp: new Date().toISOString()
        };
        return { ...a, status: AssetStatus.Available, history: [...a.history, hist] };
      }
      return a;
    });

    if (sessionUser) {
      DB.logActivity(sessionUser.id, "Resolve Maintenance", `Marked maintenance request ${id} as Resolved`);
    }
    return HttpResponse.json({ ...req, status: MaintenanceStatus.Resolved });
  }),

  // --- Audits ---
  http.get(`${API_URL}/audits`, () => {
    return HttpResponse.json({ data: DB.audits });
  }),

  http.get(`${API_URL}/audits/:id`, ({ params }) => {
    const { id } = params;
    const cycle = DB.audits.find(c => c.id === id);
    if (!cycle) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Audit cycle not found" }, { status: 404 });
    }
    const items = DB.auditItems.filter(i => i.cycleId === id);
    return HttpResponse.json({ cycle, items });
  }),

  http.post(`${API_URL}/audits`, async ({ request }) => {
    const body = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }

    const cycleId = `aud-${Date.now()}`;
    const newCycle: AuditCycle = {
      id: cycleId,
      name: body.name,
      departmentId: body.departmentId || null,
      location: body.location,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: AuditCycleStatus.Open,
      auditorIds: body.auditorIds || []
    };

    // Filter assets that match this audit scope (department and/or location)
    const matchingAssets = DB.assets.filter(a => {
      const matchDept = body.departmentId ? a.departmentId === body.departmentId : true;
      const matchLoc = body.location ? (a.location || "").toLowerCase().includes(body.location.toLowerCase()) : true;
      return matchDept && matchLoc;
    });

    // Create AuditItems for each matching asset
    const items: AuditItem[] = matchingAssets.map(a => ({
      id: `ai-${Date.now()}-${a.id}`,
      cycleId,
      assetId: a.id,
      result: undefined,
      notes: ""
    }));

    DB.audits = [...DB.audits, newCycle];
    DB.auditItems = [...DB.auditItems, ...items];

    DB.logActivity(sessionUser.id, "Create Audit Cycle", `Started audit cycle: ${body.name} containing ${items.length} items`);
    return HttpResponse.json({ cycle: newCycle, items });
  }),

  http.post(`${API_URL}/audits/:id/items/:itemId`, async ({ params, request }) => {
    const { id, itemId } = params;
    const { result, notes } = (await request.json()) as any;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser) {
      return HttpResponse.json({ statusCode: 401, code: ErrorCode.UNAUTHORIZED, message: "Unauthenticated" }, { status: 401 });
    }

    const cycle = DB.audits.find(c => c.id === id);
    if (!cycle) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Audit cycle not found" }, { status: 404 });
    }
    if (cycle.status === AuditCycleStatus.Closed) {
      return HttpResponse.json({ statusCode: 400, code: ErrorCode.VALIDATION_ERROR, message: "Cannot edit items in a closed audit cycle." }, { status: 400 });
    }

    let updatedItem: AuditItem | undefined;
    DB.auditItems = DB.auditItems.map(i => {
      if (i.id === itemId) {
        updatedItem = {
          ...i,
          result,
          notes,
          auditedById: sessionUser.id,
          auditedAt: new Date().toISOString()
        };
        return updatedItem;
      }
      return i;
    });

    if (!updatedItem) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Audit item not found" }, { status: 404 });
    }

    // Update audit cycle status to InProgress if it is currently Open
    if (cycle.status === AuditCycleStatus.Open) {
      DB.audits = DB.audits.map(c => c.id === id ? { ...c, status: AuditCycleStatus.InProgress } : c);
    }

    return HttpResponse.json(updatedItem);
  }),

  http.post(`${API_URL}/audits/:id/close`, async ({ params }) => {
    const { id } = params;
    const sessionUser = DB.getSessionUser();
    if (!sessionUser || (sessionUser.role !== Role.Admin && sessionUser.role !== Role.AssetManager)) {
      return HttpResponse.json({ statusCode: 403, code: ErrorCode.FORBIDDEN_ROLE, message: "Elevated role required" }, { status: 403 });
    }

    const cycle = DB.audits.find(c => c.id === id);
    if (!cycle) {
      return HttpResponse.json({ statusCode: 404, code: ErrorCode.NOT_FOUND, message: "Audit cycle not found" }, { status: 404 });
    }

    DB.audits = DB.audits.map(c => c.id === id ? { ...c, status: AuditCycleStatus.Closed } : c);

    // Hard Rule: Closing an audit cycle locks it; confirmed missing can set asset "Lost"
    const items = DB.auditItems.filter(i => i.cycleId === id);
    let lostCount = 0;
    let damagedCount = 0;

    items.forEach(item => {
      if (item.result === AuditItemResult.Missing) {
        lostCount++;
        DB.assets = DB.assets.map(a => {
          if (a.id === item.assetId) {
            const hist: AssetHistory = {
              id: `h-${Date.now()}-${a.id}`,
              assetId: a.id,
              action: "Audit Missing",
              performedBy: sessionUser.name,
              details: "Asset marked as Lost due to missing audit result upon cycle closure.",
              timestamp: new Date().toISOString()
            };
            return { ...a, status: AssetStatus.Lost, history: [...a.history, hist] };
          }
          return a;
        });
      } else if (item.result === AuditItemResult.Damaged) {
        damagedCount++;
        // Auto trigger a maintenance review notification or update condition
        DB.assets = DB.assets.map(a => {
          if (a.id === item.assetId) {
            const hist: AssetHistory = {
              id: `h-${Date.now()}-${a.id}`,
              assetId: a.id,
              action: "Audit Damaged",
              performedBy: sessionUser.name,
              details: "Audit flagged asset as Damaged.",
              timestamp: new Date().toISOString()
            };
            return { ...a, condition: "Damaged (Audit Flagged)", history: [...a.history, hist] };
          }
          return a;
        });
      }
    });

    DB.logActivity(sessionUser.id, "Close Audit Cycle", `Closed audit cycle ${cycle.name}. Flagged ${lostCount} assets Lost and ${damagedCount} Damaged.`);
    return HttpResponse.json({ message: "Audit cycle closed successfully", lostCount, damagedCount });
  }),

  // --- Reports & Analytics ---
  http.get(`${API_URL}/reports/utilization`, () => {
    // Return category-wise asset utilization
    const assets = DB.assets;
    const categories = DB.categories;
    const data = categories.map(cat => {
      const catAssets = assets.filter(a => a.categoryId === cat.id);
      const allocated = catAssets.filter(a => a.status === AssetStatus.Allocated || a.status === AssetStatus.Reserved).length;
      const total = catAssets.length;
      const rate = total > 0 ? Math.round((allocated / total) * 100) : 0;
      return {
        category: cat.name,
        allocated,
        available: total - allocated,
        total,
        rate
      };
    });
    return HttpResponse.json({ data });
  }),

  http.get(`${API_URL}/reports/maintenance`, () => {
    // Return breakdown by priority and cost
    const reqs = DB.maintenance;
    const priorities = Object.values(MaintenancePriority);
    const data = priorities.map(pri => {
      const count = reqs.filter(r => r.priority === pri).length;
      const resolved = reqs.filter(r => r.priority === pri && r.status === MaintenanceStatus.Resolved).length;
      return {
        priority: pri,
        count,
        resolved,
        pending: count - resolved
      };
    });
    return HttpResponse.json({ data });
  }),

  http.get(`${API_URL}/reports/department-summary`, () => {
    const assets = DB.assets;
    const depts = DB.departments;
    const data = depts.map(dept => {
      const deptAssets = assets.filter(a => a.departmentId === dept.id);
      const cost = deptAssets.reduce((sum, a) => sum + (a.acquisitionCost || 0), 0);
      return {
        department: dept.name,
        count: deptAssets.length,
        cost
      };
    });
    return HttpResponse.json({ data });
  }),

  http.get(`${API_URL}/reports/heatmap`, () => {
    // Mock heatmap of booking events over days of the week vs hours
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const hours = ["09:00", "11:00", "13:00", "15:00", "17:00"];
    const data = days.flatMap(day =>
      hours.map(hour => ({
        day,
        hour,
        value: Math.floor(Math.random() * 8)
      }))
    );
    return HttpResponse.json({ data });
  }),

  // --- Notifications ---
  http.get(`${API_URL}/notifications`, () => {
    const user = DB.getSessionUser();
    if (!user) return HttpResponse.json({ data: [] });
    // Global admin alerts + own alerts
    const alerts = DB.notifications.filter(n => n.userId === user.id || (user.role === Role.Admin && n.userId === "usr-1"));
    return HttpResponse.json({ data: alerts });
  }),

  http.post(`${API_URL}/notifications/:id/read`, ({ params }) => {
    const { id } = params;
    DB.notifications = DB.notifications.map(n => n.id === id ? { ...n, read: true } : n);
    return HttpResponse.json({ success: true });
  }),

  // --- Activity Logs ---
  http.get(`${API_URL}/activity-logs`, () => {
    const user = DB.getSessionUser();
    if (!user || (user.role !== Role.Admin && user.role !== Role.AssetManager)) {
      // Employees see only their logs
      const ownLogs = DB.activityLogs.filter(l => l.performedById === user?.id);
      return HttpResponse.json({ data: ownLogs });
    }
    return HttpResponse.json({ data: DB.activityLogs });
  }),

  // --- Admin Session Swapping Tool (Hackathon-specific bypass) ---
  http.post(`${API_URL}/auth/session-swap`, async ({ request }) => {
    const { userId } = (await request.json()) as any;
    const user = DB.users.find(u => u.id === userId);
    if (!user) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }
    DB.setSessionUser(userId);
    return HttpResponse.json({ user, success: true });
  })
];
