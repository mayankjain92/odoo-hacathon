# AssetFlow — Docker Dev Stack Design

**Date:** 2026-07-12  
**Status:** Approved direction (hackathon/dev mode + MinIO) — pending user review of this doc  
**Goal:** One command brings up Postgres, Redis, MinIO, schema sync/seed, API, and web with hot reload so local process management is not a headache.

---

## Success criteria

- `docker compose -f infra/docker-compose.yml up` (or `pnpm stack`) starts the full stack.
- Browser: web on `http://localhost:3000`, API on `http://localhost:4000`, Swagger on `http://localhost:4000/docs`.
- First boot: `prisma generate` → `db push` → seed run automatically before API serves traffic.
- Code edits under `apps/*` and `packages/*` hot-reload inside containers (bind mounts).
- Stopping: `docker compose -f infra/docker-compose.yml down` (volumes optional via `-v`).

---

## Mode

**Hackathon / dev only** (Approach A / compose Approach 1).

- Not production multi-stage images.
- `nest start --watch` and `next dev --turbopack`.
- Schema sync via `prisma db push` (not interactive `migrate dev`).

---

## Services

| Service | Image / build | Role | Host ports |
|---------|---------------|------|------------|
| `postgres` | `postgres:17-alpine` | Primary DB | `5432` |
| `redis` | `redis:7-alpine` | Cache / queues | `6379` |
| `minio` | `minio/minio` | Object storage (optional app use) | `9000`, `9001` (console) |
| `migrate` | build from repo (Node 22 + pnpm) | One-shot: install deps (cached) → `prisma generate` → `db push` → seed → exit 0 | none |
| `api` | same base as migrate | Nest watch server | `4000` |
| `web` | same base / similar | Next dev server | `3000` |

### Ordering

```
postgres (healthy) ─┬─► migrate (success) ─► api (started) ─► web
redis (healthy) ────┘
minio               (parallel; no hard dependency for API boot)
```

- `migrate` `depends_on`: `postgres` condition `service_healthy`.
- `api` `depends_on`: `migrate` condition `service_completed_successfully`, `redis` healthy.
- `web` `depends_on`: `api` started (not necessarily healthy HTTP probe on day one; optional later).

### Volumes

- Named: `assetflow_pg`, `assetflow_redis`, `assetflow_minio` (persist data).
- Named: `assetflow_node_modules` (or per-app) for container `node_modules` so host OS mounts do not wipe Linux deps.
- Bind: repo root (or `apps/api`, `apps/web`, `packages/*`) for live code.

---

## Dockerfiles / entrypoints

- `infra/Dockerfile.dev` — Node 22, enable corepack/pnpm, copy workspace manifests, install, default CMD overridden per service.
- `infra/docker-entrypoint-migrate.sh` — wait not required if compose healthgate is enough; run generate, push, seed; exit.
- `infra/docker-entrypoint-api.sh` — ensure shared package built if needed → `pnpm --filter @assetflow/api dev`.
- `infra/docker-entrypoint-web.sh` — `pnpm --filter @assetflow/web dev`.

Monorepo note: build context is **repo root** so workspace packages resolve. `pnpm fetch` / filtered install is acceptable; prefer one install layer cached on lockfile change.

---

## Environment

- Compose reads `infra/.env` or repo-root `.env` (document one source of truth: **repo root `.env`** copied from `.env.example`).
- Inside Docker network:
  - `DATABASE_URL=postgresql://assetflow:assetflow@postgres:5432/assetflow?schema=public`
  - `REDIS_URL=redis://redis:6379`
  - MinIO endpoint host `minio` for server-side clients; browser/console still `localhost:9001`.
- Browser-facing:
  - `NEXT_PUBLIC_API_URL=http://localhost:4000/api` (host-mapped API, not `http://api:4000`).
  - `API_CORS_ORIGIN=http://localhost:3000`
- Cloudinary placeholders remain env-driven (no secrets in compose file).
- JWT secrets from `.env` with documented dev defaults matching `.env.example`.

---

## Package scripts

Update root `package.json`:

- `infra:up` → compose up detached for full stack (or keep infra-only name and add `stack`).
- `stack` / `stack:up` → `docker compose -f infra/docker-compose.yml up --build`
- `stack:down` → `down`
- `stack:logs` → `logs -f`

Existing host-only `pnpm dev` remains for people who still run API/web on the host against compose infra only.

---

## Out of scope

- Production images / Kubernetes / CI deploy.
- Replacing Cloudinary with MinIO in app code (MinIO is available in the stack; app may keep using Cloudinary via env).
- Interactive Prisma Studio as a compose service (optional later).
- Windows-specific path quirks beyond documenting Docker Desktop requirement.

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Host `node_modules` vs Linux binary mismatch | Anonymous/named volume for `node_modules`; never rely on macOS `node_modules` inside container |
| Slow first boot | Cache pnpm store volume; document first-build time |
| Port conflicts with host `bun run dev` | Document: stop host API/web before `stack:up`, or change ports in `.env` |
| `db push` on dirty local DB | Acceptable for hackathon; data wipe via `down -v` |
| Seed non-idempotent | Seed should upsert or no-op if admin exists (use current seed behavior; fix only if it fails on re-run) |

---

## Acceptance checks

1. Fresh `down -v` + `stack:up` → migrate exits 0 → API logs “running on :4000” → web serves `/`.
2. `GET /api/health` → 200.
3. Login with seeded admin → `GET /api/assets` → 200 (no missing-column errors).
4. Edit a Nest controller file → API recompiles without rebuild image.
5. MinIO console reachable at `http://localhost:9001`.

---

## File touch list (implementation)

- `infra/docker-compose.yml` (expand)
- `infra/Dockerfile.dev`
- `infra/docker-entrypoint-*.sh`
- `.env.example` (Docker URLs notes)
- `package.json` scripts
- Short `infra/README.md` or section in root README: one-command usage
