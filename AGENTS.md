# LINKO Agent Guide

Buyer-wholesaler marketplace and parcel-logistics platform for MSMEs. React 19 + Vite 8 JSX frontend (`src/`) and Express 5 + PostgreSQL backend (`backend/`, deployed via `api/index.js` on Vercel). Node 22 (`>=20.19.0`).

## Commands

```bash
npm run check                   # lint + unit tests + production build (run before finishing)
npm run test:backend            # backend integration & unit test suite
npm --prefix backend run migrate # apply sequential SQL migrations to DATABASE_URL
```

## Hard Invariants

- **Database & Pool:** Express 5 + raw `pg.Pool` via `backend/src/db.js` only (never import `pg` in routes/services).
- **Authorization (Zero RLS):** Postgres has no RLS. Every protected route must enforce `requireAuth`, `requireAnyRole` / `requireGlobalRole`, and active-business ownership via `X-Active-Business` — with **zero** implicit `platform_admin` bypass.
- **Business Model:** One marketplace role per business (`buyer` OR `wholesaler`, never both). `MSME` is a customer segment, not a role; avoid three-entity `manufacturer -> wholesaler -> retailer` framing.
- **Frontend API Client:** All HTTP calls go through `src/lib/api.js` (no raw `fetch()`). Thrown errors expose `error.status`, not `statusCode`.
- **UI & Icons:** Use `DESIGN.md` tokens/primitives and `lucide-react` icons only. No static inline `style={{}}`.
- **Migrations:** Sequential `001..031+` in `backend/migrations/` are auto-applied to Supabase on push to `main` via `.github/workflows/migrate.yml`. Never edit applied migrations; keep `backend/schema.sql` in sync.
- **Repo Hygiene:** Never commit scratch artifacts (`tmp/`, `output/`, `Claude outputs/`) and never copy markup/CSS from legacy `designs/`.

## Scoped Guides & Contracts

- `CODING_STANDARDS.md` — engineering judgment, smells, and review rules
- `DESIGN.md` — CSS tokens, semantic palette, z-index ladder, canonical UI components
- `docs/API_CONTRACTS.md` — canonical request/response payloads
- `docs/linko_database_specification.md` — current PostgreSQL schema specification
- `src/AGENTS.md` — frontend module boundaries, RBAC helpers, and UI rules
- `backend/AGENTS.md` — Express 5 routes, shared errors, RBAC, and logistics confidentiality
- `backend/migrations/AGENTS.md` — migration numbering, schema sync, and DDL rules

## Branching & Deployment

- Non-DB changes: branch from `main` (`dev/<name>`) -> PR to `main`.
- DB changes (migrations, `schema.sql`, dependent routes): PR to `staging` (local Postgres only; take next migration number from `staging`), then merge `staging` -> `main`.
- Vercel serves frontend + `api/index.js` on `main` (does not run migrations/seeds; `.github/workflows/migrate.yml` applies migrations on `main`).
- Conventional Commits: `<type>(<scope>): <desc>`, lowercase imperative, no trailing period.
