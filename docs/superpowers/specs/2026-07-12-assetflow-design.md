# AssetFlow — Hybrid Full-Stack Design (2026-07-12)

Enterprise Asset & Resource Management System for the Odoo hackathon.  
Goal: **Hybrid** — shippable UI + full feature coverage, with a modular/scalable NestJS backend and a frozen OpenAPI contract so frontend and backend can be built **in parallel**.

## Decisions locked

| Decision | Choice |
|----------|--------|
| Goal | Hybrid (POC speed + production-minded architecture) |
| Backend | NestJS 11 (TypeScript modular monolith) |
| Data | PostgreSQL 17 + Redis 7 (Docker Compose) |
| Repo | pnpm + Turborepo monorepo with `packages/shared` |
| Architecture | Modular monolith + BullMQ workers (not microservices day one) |

## Monorepo layout

```
apps/web              Next.js 15 App Router (frontend)
apps/api              NestJS 11 API + BullMQ workers
packages/shared       OpenAPI types, Zod schemas, enums, RBAC constants
packages/ui           Design tokens / shared primitives (optional)
infra/docker-compose  Postgres 17, Redis 7, MinIO (optional for files)
docs/                 Specs, OpenAPI freeze notes
```

## Tech stack

### Frontend (`apps/web`)

- **Next.js 15** (App Router) + **React 19**
- **TanStack Query v5** — server state, pagination, infinite scroll, optimistic mutations, stale-while-revalidate
- **TanStack Table** — asset directory, employees, audits (URL-synced filters)
- **Zustand** — UI-only state (drawers, calendar selection)
- **React Hook Form + Zod** — forms validated against shared schemas
- **Tailwind CSS v4 + shadcn/ui** — accessible primitives
- **Framer Motion** — 2–3 intentional motions (page enter, drawer, KPI count-up)
- **next/image**, route `loading.tsx` / `error.tsx`, Suspense for KPI strips
- **MSW** (dev) — mock API from frozen OpenAPI until backend catches up
- **Recharts** (or Tremor) — reports & heatmaps

### Backend (`apps/api`)

- **NestJS 11** + modular domain modules
- **Prisma** + PostgreSQL 17
- **Redis 7** + **BullMQ** — overdue scans, booking reminders, report exports
- **@nestjs/swagger** → OpenAPI → codegen into `packages/shared`
- **JWT** access + refresh (httpOnly cookie via Next proxy preferred; Bearer for tools)
- **Passport + Guards** — RBAC: `Admin | AssetManager | DepartmentHead | Employee`
- **class-validator / Zod** DTOs aligned with shared package
- File uploads → local disk or S3-compatible (MinIO in compose)
- Structured logging + `/health` + `/ready`

### Shared contract (`packages/shared`)

- Enums: asset states, booking statuses, maintenance workflow, roles
- Pagination shape: `{ data: T[]; meta: { page; pageSize; total; totalPages } }`
- Error shape: `{ statusCode; code; message; details? }`
- Generated TypeScript client types from OpenAPI

## Domain modules (Nest)

| Module | Responsibility |
|--------|----------------|
| `auth` | Signup (Employee only), login, refresh, forgot password |
| `org` | Departments (hierarchy), categories (+ optional fields), employee directory, role promotion |
| `assets` | Register, auto tag `AF-####`, lifecycle, search/QR, photos, per-asset history |
| `allocations` | Allocate / return / transfer; conflict → 409 + holder; overdue flags |
| `bookings` | Calendar, overlap validation (adjacent OK), cancel/reschedule |
| `maintenance` | Pending → Approved/Rejected → Assigned → InProgress → Resolved |
| `audits` | Cycles, auditors, Verified/Missing/Damaged, discrepancy report, close/lock |
| `reports` | Utilization, maintenance frequency, dept summary, booking heatmap, exports |
| `notifications` | In-app feed + activity log |
| `jobs` | BullMQ processors |

## Core data model

**Entities:** `User`, `Department`, `AssetCategory`, `Asset`, `Allocation`, `TransferRequest`, `Booking`, `MaintenanceRequest`, `AuditCycle`, `AuditItem`, `Notification`, `ActivityLog`

**Asset lifecycle states:**  
`Available | Allocated | Reserved | UnderMaintenance | Lost | Retired | Disposed`

**Hard rules (must be API-enforced):**

1. Signup never assigns Admin / Asset Manager / Department Head.
2. Admin promotes roles only from Employee Directory.
3. Cannot allocate an already-held asset → `409 CONFLICT` with holder + suggest transfer.
4. Booking overlaps rejected; end time of A == start time of B is allowed.
5. Asset → `UnderMaintenance` only when maintenance request is **approved**.
6. Asset → `Available` when maintenance resolved (if no other hold) or on return.
7. Overdue allocations (past expected return) auto-flagged by job → dashboard + notifications.
8. Closing an audit cycle locks it; confirmed missing can set asset `Lost`.

## Screens (map 1:1 to problem statement)

1. Login / Signup / Forgot password  
2. Dashboard (role-aware KPIs + overdue + quick actions)  
3. Organization Setup (Admin) — Departments | Categories | Employees  
4. Asset Registration & Directory  
5. Asset Allocation & Transfer  
6. Resource Booking (calendar)  
7. Maintenance Management  
8. Asset Audit  
9. Reports & Analytics  
10. Activity Logs & Notifications  

## RBAC matrix (summary)

| Capability | Admin | Asset Manager | Dept Head | Employee |
|------------|:-----:|:-------------:|:---------:|:--------:|
| Org setup / promote roles | ✓ | | | |
| Register assets | ✓ | ✓ | | |
| Allocate / approve returns | ✓ | ✓ | limited | |
| Approve transfers | ✓ | ✓ | dept | request |
| Book resources | ✓ | ✓ | ✓ | ✓ |
| Raise maintenance | ✓ | ✓ | ✓ | ✓ |
| Approve maintenance | ✓ | ✓ | | |
| Create/close audits | ✓ | ✓ | | |
| Perform audit items | assigned | assigned | | |
| Org-wide reports | ✓ | ✓ | dept | own |

## UI/UX direction

- One clear app shell: sidebar (role-filtered) + top bar (search, notifications bell, user menu).
- Dashboard first viewport: brand/product **AssetFlow**, KPI strip, overdue callout, 3 quick actions — not a cluttered card farm.
- Density: comfortable tables with sticky headers, filter chips in URL, skeleton loaders.
- Visual: defined CSS variables (avoid generic purple/cream AI defaults); soft gradients + real empty-state illustrations for directories.
- Motion: page fade-slide, drawer spring, subtle KPI animate — no glow spam.
- Accessibility: keyboard calendar booking, focus rings, ARIA for dialogs.

## Data flow

```
Browser → Next.js (RSC for shell/static) → TanStack Query → Nest API
                                              ↓
                                    Postgres (source of truth)
                                              ↓
                                    Redis/BullMQ (jobs, optional SSE pub)
                                              ↓
                                    Notifications / dashboard KPIs
```

- Mutations invalidate related Query keys (`assets`, `allocations`, `dashboard`).
- Optimistic UI for cancel booking / mark notification read; rollback on error.
- Conflict responses (`409`) open a guided transfer-request sheet on the FE.

## Error handling

- API: domain error codes (`ASSET_ALREADY_ALLOCATED`, `BOOKING_OVERLAP`, `FORBIDDEN_ROLE`, …).
- FE: toast + inline form errors; global error boundary per route segment.
- Jobs: retry with backoff; dead-letter visibility in Admin activity log.

## Testing strategy

- **API:** unit (services) + e2e (supertest) for conflict rules, RBAC, booking overlap.
- **Web:** Playwright for critical flows (signup→allocate→book→maintenance).
- **Contract:** CI check that Nest Swagger matches `packages/shared` OpenAPI snapshot.

## Parallel build workflow

### Phase 0 — Shared (both agents wait on this, ~half day)

1. Scaffold monorepo + Docker Compose (Postgres, Redis).
2. Freeze OpenAPI stub + Zod enums in `packages/shared`.
3. Seed users: 1 Admin, sample departments, categories (Admin created via seed, never signup).

### Phase 1 — Parallel tracks

**Frontend track** builds all 10 screens against MSW using shared types.  
**Backend track** implements modules + workers against the same OpenAPI.

### Phase 2 — Integration

1. Point web at real API (`NEXT_PUBLIC_API_URL`).
2. Swap MSW off; fix contract mismatches.
3. Wire SSE/polling for notifications.
4. E2E happy path + conflict demos.

### Phase 3 — Polish

KPI accuracy, report exports, empty states, performance (pagination everywhere), demo seed script.

---

## Copy-paste prompts for parallel agents

Use these in **two separate Cursor chats** (or two agents) after Phase 0 is done.

### Prompt A — Frontend agent

```text
You are building the AssetFlow frontend only in a Turborepo monorepo.

CONTEXT
- Product: Enterprise Asset & Resource Management (AssetFlow).
- Architecture: Hybrid POC + scalable design. Backend is a separate NestJS app.
- Repo paths: apps/web (Next.js), packages/shared (OpenAPI types + Zod enums). DO NOT implement apps/api.
- Contract: Consume types/schemas from packages/shared. Use MSW handlers that match the frozen OpenAPI until the real API is ready.

STACK (required)
- Next.js 15 App Router, React 19
- TanStack Query v5 for all server state (paginated lists, infinite scroll where useful, optimistic mutations)
- TanStack Table + URL searchParams for filters/sort/page
- Zustand for UI-only state
- React Hook Form + Zod (shared schemas)
- Tailwind v4 + shadcn/ui + Framer Motion (subtle)
- next/image, loading.tsx/error.tsx per major route

SCREENS TO BUILD (all)
1. Auth: Login, Signup (Employee only — no role picker), Forgot password
2. Dashboard: KPIs (Available, Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns), overdue section, quick actions
3. Organization Setup (Admin): tabs Departments / Categories / Employees (promote roles here only)
4. Asset Directory: register, search/filter, lifecycle badge, detail with allocation+maintenance history, photo upload UI
5. Allocation & Transfer: allocate with expected return; on conflict show holder + Transfer Request CTA; return with condition notes; transfer Requested→Approved flow UI
6. Resource Booking: calendar per resource, overlap errors surfaced clearly, cancel/reschedule
7. Maintenance: raise request, priority, photo; pipeline board/table for statuses
8. Audits: create cycle, assign auditors, mark Verified/Missing/Damaged, discrepancy report view, close cycle
9. Reports: charts for utilization, maintenance frequency, dept summary, booking heatmap; export buttons
10. Notifications & Activity log

RBAC UX
- Sidebar items filtered by role: Admin | AssetManager | DepartmentHead | Employee
- Guard routes; show empty/forbidden states cleanly

UI/UX BAR
- Eye-candy but usable: clear hierarchy, skeletons, toasts, empty states
- Avoid generic purple-on-white / cream-serif AI aesthetics; define a distinctive token set
- First dashboard viewport: product name, KPIs, overdue, quick actions — not clutter

QUALITY
- Every list is paginated via TanStack Query
- Prefer Server Components for shell; Client Components for interactive tables/calendars/forms
- Colocate features under apps/web/src/features/*
- Mock data only via MSW matching packages/shared

Deliver working UI with mock API. Do not wait on backend implementation details beyond the shared contract.
```

### Prompt B — Backend agent

```text
You are building the AssetFlow backend only in a Turborepo monorepo.

CONTEXT
- Product: Enterprise Asset & Resource Management (AssetFlow).
- Architecture: NestJS modular monolith + Redis/BullMQ workers (distributed-ready, not microservices yet).
- Repo paths: apps/api, packages/shared, infra/docker-compose. DO NOT build the Next.js UI.
- Contract: Implement REST API so Nest Swagger matches packages/shared OpenAPI exactly. Pagination: { data, meta: { page, pageSize, total, totalPages } }. Errors: { statusCode, code, message, details? }.

STACK (required)
- NestJS 11, Prisma, PostgreSQL 17, Redis 7, BullMQ
- @nestjs/swagger for OpenAPI
- JWT access + refresh, Passport guards, RBAC roles: Admin | AssetManager | DepartmentHead | Employee
- Transactions for allocation conflict and booking overlap checks

MODULES
auth, org, assets, allocations, bookings, maintenance, audits, reports, notifications, jobs

HARD BUSINESS RULES
1. Signup creates Employee only — never self-assign elevated roles
2. Only Admin promotes Department Head / Asset Manager from employee directory
3. Allocate conflict: if asset held → 409 ASSET_ALREADY_ALLOCATED with holder payload
4. Booking overlap rejected; adjacent slots (end == start) allowed
5. Asset status UnderMaintenance only on maintenance APPROVAL; Available on resolve/return as appropriate
6. Transfer: Requested → Approved → re-allocate; write history
7. Overdue job flags allocations past expectedReturnAt; emit notifications
8. Booking reminder job before slot start
9. Audit close locks cycle; missing can set Lost; generate discrepancy report
10. ActivityLog for admin/manager/employee actions

ASSET STATES
Available | Allocated | Reserved | UnderMaintenance | Lost | Retired | Disposed

FEATURES MAX (scalable)
- Soft delete / deactivate for departments & employees
- Optimistic locking or SELECT FOR UPDATE on allocate/book
- Indexes on assetTag, serialNumber, status, departmentId, time ranges
- File upload endpoints for asset/maintenance photos
- Report export as async BullMQ job returning jobId + download when ready
- Health endpoints; structured logs
- Seed script: Admin user, sample depts, categories, assets, bookings

TESTING
- e2e tests for: signup role lock, allocate conflict, booking overlap, maintenance status transition, audit close

Expose stable REST + Swagger. Keep modules isolated so a future split to services is possible without rewriting domain logic.
```

### Prompt C — Integration agent (after both tracks)

```text
Integrate AssetFlow apps/web with apps/api.

1. Remove/disable MSW; point TanStack Query at real API (cookie or Bearer auth as implemented).
2. Fix any OpenAPI drift; regenerate packages/shared if needed.
3. Verify RBAC on every screen with seeded users.
4. Demo script path: Admin setup → register asset → allocate → conflict/transfer → book resource → maintenance approve → audit cycle → notifications/KPIs.
5. Add Playwright e2e for that path.
6. Performance pass: ensure all directories use server pagination; dashboard KPIs from dedicated endpoint not N+1 client fetches.
```

## Out of scope (per problem statement)

Purchasing, invoicing, accounting, payroll, inventory valuation beyond acquisition cost for ranking/reports.
```
