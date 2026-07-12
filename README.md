# AssetFlow

Enterprise Asset & Resource Management — Turborepo monorepo template.

## Structure

```
apps/web          Next.js 15 (App Router) + TanStack Query
apps/api          NestJS 11 modular monolith + Prisma
packages/shared   Enums, Zod schemas, pagination/error contracts
packages/ui       Design tokens
infra/            Docker Compose (Postgres 17, Redis 7, MinIO)
docs/             Design specs
```

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker Desktop (for Postgres/Redis/MinIO)

## Quick start

```bash
pnpm install
pnpm infra:up
cp .env.example apps/api/.env   # already seeded for local defaults
pnpm --filter @assetflow/shared build
pnpm --filter @assetflow/ui build
pnpm db:generate
pnpm db:migrate                 # first time: create migration
pnpm db:seed
pnpm dev                        # web :3000 + api :4000
```

Useful URLs:

- Web: http://localhost:3000
- API: http://localhost:4000/api/health
- Swagger: http://localhost:4000/docs

Seeded admin: `admin@assetflow.local` / `Admin@12345`

## Parallel development

1. Freeze / extend contracts in `packages/shared`
2. Frontend agent → `apps/web` (+ MSW in `src/mocks`)
3. Backend agent → `apps/api` domain modules
4. Design reference: `docs/superpowers/specs/2026-07-12-assetflow-design.md`

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Run all apps |
| `pnpm dev:web` / `pnpm dev:api` | Run one side |
| `pnpm infra:up` / `infra:down` | Docker services |
| `pnpm db:migrate` / `db:seed` | Prisma |
| `pnpm build` | Build all packages/apps |
