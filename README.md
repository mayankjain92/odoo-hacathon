# AssetFlow

Enterprise asset & resource management platform — a Turborepo monorepo pairing a
NestJS modular-monolith API with a Next.js App Router frontend.

AssetFlow tracks an organisation's assets through their whole lifecycle:
registration, allocation to employees/departments, transfers, shared-resource
bookings, maintenance, physical audits, and reporting — with role-based access
control, an activity audit trail, and background jobs for overdue/booking
automation.

---

## Architecture

```
                         ┌─────────────────────────────┐
                         │   apps/web  (Next.js 15)     │
                         │   App Router · TanStack Query│
                         │   JWT in localStorage        │
                         └──────────────┬──────────────┘
                                        │  HTTP  /api/*  (Bearer access token)
                                        ▼
                         ┌─────────────────────────────┐
                         │   apps/api  (NestJS 11)      │
                         │   Modular monolith           │
                         │   Global prefix /api         │
                         │   Swagger at /docs           │
                         └───┬───────────┬───────────┬──┘
                             │           │           │
                    ┌────────▼──┐  ┌─────▼─────┐ ┌───▼────────┐
                    │ Postgres  │  │   Redis   │ │ Cloudinary │
                    │ (Prisma)  │  │ (jobs/    │ │ (photos &  │
                    │           │  │  queues)  │ │  documents)│
                    └───────────┘  └───────────┘ └────────────┘
```

Shared TypeScript contracts (`packages/shared`) sit between the two apps so
enums, Zod schemas, and pagination/error envelopes stay in lockstep.

### Request lifecycle (API)

1. `JwtAuthGuard` validates the access token; the JWT strategy loads the user
   and attaches an `AuthUserView` to the request.
2. `RolesGuard` + `@Roles(...)` enforce RBAC on protected routes.
3. Controllers read the caller via the `@CurrentUser()` decorator, delegate to a
   service, and return a typed response.
4. Domain mutations run inside Prisma transactions and write an `ActivityLog`
   entry; some also emit `Notification`s.
5. Errors are normalised to `ApiException` → `{ code, message, details }` with an
   `ErrorCode` from `packages/shared`.

---

## Tech stack

| Layer        | Technology |
|--------------|------------|
| Frontend     | Next.js 15 (App Router), React, TanStack Query, MSW (env-gated mocks) |
| Backend      | NestJS 11 (modular monolith), Passport JWT, Swagger |
| ORM / DB     | Prisma → PostgreSQL 17 |
| Jobs / cache | Redis 7 (overdue scans, booking transitions, reminders) |
| Media        | Cloudinary (asset photos & documents) |
| Shared       | TypeScript enums, Zod schemas, error/pagination contracts |
| Tooling      | Turborepo, pnpm workspaces, ESLint, tsc |

---

## Monorepo layout

```
apps/
  web/                 Next.js frontend
    src/app/(auth)/     login, signup, forgot-password
    src/app/(app)/      dashboard, assets, allocations, bookings,
                        maintenance, audits, reports, notifications, org
    src/lib/api.ts      fetch client (attaches Bearer token)
    src/mocks/          MSW handlers (only active when NEXT_PUBLIC_API_MOCKING=enabled)
  api/                 NestJS backend
    src/<module>/       one folder per domain module (see below)
    prisma/             schema.prisma, seed.ts, integration test scripts
packages/
  shared/              enums, Zod schemas, ErrorCode, pagination helpers
  ui/                  design tokens
infra/                 docker-compose (Postgres 17, Redis 7, MinIO)
docs/                  design specs
```

### API modules (`apps/api/src`)

| Module        | Responsibility |
|---------------|----------------|
| `auth`        | Signup/login, JWT access+refresh, password reset, `@CurrentUser`, guards |
| `org`         | Departments (hierarchy + head), asset categories, employees, role promotion |
| `assets`      | Asset CRUD, auto asset-tag sequence, status lifecycle, photo/document upload |
| `allocations` | Allocate/return assets, transfer requests, overdue scanning |
| `bookings`    | Shared-resource bookings, overlap prevention, status transitions, reminders |
| `maintenance` | Maintenance requests and status workflow |
| `audits`      | Audit cycles, assigned auditors, tag-scan item recording, close-out |
| `notifications` | Per-user notifications + admin activity-log feed |
| `reports`     | Dashboard KPIs, utilization, heatmaps, department/category summaries, CSV export |
| `jobs`        | Trigger endpoints for the background automations |
| `health`, `prisma`, `common/cloudinary`, `common/errors` | Infrastructure/support |

---

## Domain model

Core entities (`apps/api/prisma/schema.prisma`):

- **User / Department** — employees belong to departments; departments form a
  hierarchy and reference a head user.
- **AssetCategory / Asset** — assets carry a unique auto-generated tag, a status,
  optional department, and Cloudinary media metadata.
- **Allocation / TransferRequest** — who currently holds an asset, and requests
  to move it between holders.
- **Booking** — time-bounded reservations of shared, bookable assets.
- **MaintenanceRequest** — repair requests with priority and status.
- **AuditCycle / AuditCycleAuditor / AuditItem** — physical audit runs and results.
- **Notification / ActivityLog** — user alerts and the immutable audit trail.

### Roles (RBAC)

`Admin` › `AssetManager` › `DepartmentHead` › `Employee`. Signup always creates an
`Employee`; elevation happens via the org module. Department heads are scoped to
their own department for allocations, returns, and transfer approvals.

### Asset status lifecycle

`Available → Allocated | Reserved | UnderMaintenance` and back are **owned by the
allocation / booking / maintenance workflows**. Manual transitions
(`Lost`, `Retired`, `Disposed`) are owned by the assets module and validated
against an allowed-transition map.

### Concurrency guarantees

Booking creation/reschedule and asset allocation run their conflict check and
write **inside a single transaction guarded by a per-asset Postgres advisory
lock** (`pg_advisory_xact_lock`). This serialises concurrent operations on the
same asset, preventing double-booking and double-allocation without a schema
migration.

### Background automations

Domain jobs (triggerable via the `jobs` module, intended to be scheduled through
Redis):

- Auto-transition bookings `Upcoming → Ongoing → Completed`.
- Send booking reminders before a slot starts.
- Scan allocations past their expected return date, flag them overdue, and notify.

---

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker Desktop (Postgres / Redis / MinIO)

## Quick start

```bash
pnpm install
pnpm infra:up                       # Postgres 17, Redis 7, MinIO
cp .env.example apps/api/.env       # seeded with local defaults
pnpm --filter @assetflow/shared build
pnpm --filter @assetflow/ui build
pnpm db:generate
pnpm db:migrate                     # first run creates the migration
pnpm db:seed
pnpm dev                            # web :3000 + api :4000
```

Useful URLs:

- Web: http://localhost:3000
- API health: http://localhost:4000/api/health
- Swagger: http://localhost:4000/docs

Seeded admin: `admin@assetflow.local` / `Admin@12345`

## Environment

Copy `.env.example` and adjust as needed. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection for jobs/queues |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Token TTLs (default 15m / 7d) |
| `CLOUDINARY_*` | Media upload credentials |
| `NEXT_PUBLIC_API_URL` | API base URL the web app calls |
| `NEXT_PUBLIC_API_MOCKING` | Set to `enabled` to serve MSW mocks instead of the real API |

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Run all apps |
| `pnpm dev:web` / `pnpm dev:api` | Run one side |
| `pnpm build` | Build all packages/apps |
| `pnpm lint` | Lint the workspace |
| `pnpm typecheck` | Type-check all packages |
| `pnpm infra:up` / `infra:down` | Start/stop Docker services |
| `pnpm db:generate` | Regenerate the Prisma client |
| `pnpm db:migrate` / `db:seed` | Apply migrations / seed data |

## Testing

Prisma integration scripts under `apps/api/prisma` exercise the main domain
flows against a live database (`test-allocations.ts`, `test-maintenance.ts`,
`test-audits.ts`, `test-notifications.ts`):

```bash
pnpm --filter @assetflow/api exec tsx prisma/test-allocations.ts
```
