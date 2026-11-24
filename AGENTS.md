# LINKO agent guide

Guidance for coding agents working in this repository.

## What LINKO is

A buyer-wholesaler marketplace and operations platform for MSMEs and other businesses. The frontend is a routed React app whose pages call the Express API through `src/lib/api.js`. The backend lives in `backend/` — Express 5 + PostgreSQL with a migration runner and test suite. Higher-level architecture decisions live in `docs/`.

## Terminology heads-up

- Prefer active docs in `docs/` plus root project docs as the current source of truth. Treat `docs/archived/` as historical context only; do not revive archived concepts into active planning or implementation unless explicitly asked.
- Prefer `buyer` as the canonical demand-side workflow role.
- Treat `MSME` as a customer segment, not as a synonym for `buyer`. An MSME may act as a buyer when purchasing through LINKO.
- Prefer `wholesaler` when the supply-side marketplace actor is selling in wholesale to buyers through LINKO.
- Treat `supplier` as the broader umbrella term for entities supplying goods into a business flow or supply chain.
- A business is exactly one marketplace type — `buyer` OR `wholesaler`, never both. The dual "both" role was phased out in Sprint 9 (migration `017_phaseout_both_role`, register rejects `business_type='both'`, and the `one_marketplace_role_per_business` partial unique index blocks the combination at the schema level). Conceptually a wholesaler buying stock still _acts_ like a buyer in that transaction, but such a business must be registered as its single canonical type; the system does not model one business holding both roles.
- In active docs, avoid reintroducing out-of-scope three-entity framing such as `manufacturer -> wholesaler -> retailer/client` as if LINKO must model the full chain. Keep the primary LINKO marketplace framing focused on buyer-wholesaler discovery and connection unless product docs are intentionally revised.

## Commands

```bash
npm run dev           # Vite dev server
npm run build         # production build to dist/
npm run preview       # serve the built dist/
npm run lint          # eslint over frontend, backend/src, api, and tests
npm test              # fast Node unit tests for src/**/*.test.js and tests/**/*.test.js
npm run test:backend  # run backend/ test suite
npm run check         # lint + unit tests + production build (run before finishing)
```

## Coding standards & review

Engineering judgment rules live in `CODING_STANDARDS.md` (intentionally kept out of this file to keep session context lean). Mechanical checks run via `npm run check` (plus `npm run test:backend` when `backend/` or `api/` changed); standards and spec compliance are enforced on diffs via `/code-review` (`.agents/skills/code-review/SKILL.md`), and recurring lessons are routed via `/retro` (`.agents/skills/retro/SKILL.md`).

## Stack

- Frontend: React 19 + Vite 8, plain JSX (no TypeScript), routing with `react-router-dom`.
- Backend scaffold: Node.js/Express 5 + PostgreSQL — scaffold in `backend/` with `pg`, a custom migration runner, and Node built-in test harness. Run all backend commands from inside `backend/`:
  ```bash
  npm install        # install backend deps
  npm run migrate    # apply SQL migrations to PostgreSQL
  npm start          # start Express server on port 5000 (or $PORT)
  npm test           # run backend test suite
  ```
  Set `DATABASE_URL` (see `backend/.env.example`) before running migrate or start.
- ESLint flat config (`eslint.config.js`) lints `src/`, `backend/src/`, `api/`, and `tests/`, and mechanically enforces key LINKO boundaries (no raw `fetch()` outside API clients, generic `components/ui`, no direct `pg` imports in routes/services).

## Actual frontend layout

```
src/
  auth/                   AuthProvider
  lib/                    api.js (API client)
  hooks/
  components/ui/          generic primitives (dialogs, pagination, skeletons, search field, map picker)
  components/navigation/  Topbar, Sidebar, SubNav, MobileNav, Footer
  features/<domain>/      cart, landing, logistics, products, search, settings, suppliers
  layouts/AppLayout.jsx   shared app shell
  pages/                  route-level <Name>Page.jsx; logistics pages under pages/logistics/
```

Convention: reusable primitives in `components/ui`, domain widgets in `features/<domain>`, route-level composition in `pages/` (files are named `<Name>Page.jsx`), shared chrome in `layouts/` + `components/navigation/`. Shared page styling lives globally in `src/assets/css/shell.css`. Keep `components/ui` generic and push domain logic into `features/`.

## Source of truth for behavior (read before building)

These docs define the contracts and direction; code must follow them, not the reverse:

- `docs/API_CONTRACTS.md` — exact request/response JSON for `/api/inventory` and `/api/suppliers`. The frontend data shapes for inventory and supplier views must match these payloads.
- `docs/linko_database_specification.md` — finalized PostgreSQL schema (Users, Businesses, Products, Categories, Warehouses, Inventory_Items, Inventory_Transactions, Supplier_Profiles).
- `docs/codebase-notes/CODEBASE_OVERVIEW.md` — explains how the codebase is structured right now (frontend + backend scaffold), request flow, and suggested next build steps.
- `ROADMAP.md` — product direction and phasing (treat as the product source of truth).

Domain model is workflow-oriented, not screen-oriented: a user belongs to businesses; a business may own inventory and may also act as a wholesaler; warehouses hold inventory items with transaction history; a buyer's quote request produces wholesaler matches; a quote becomes an order; an order has shipments.

**Matching MVP is deliberately narrow:** location/proximity only (buyer location, wholesaler location/service area, distance ranking), and it must surface the proximity reason for a match. Category, MOQ, lead time, price, verification, and performance are explicitly deferred — do not require them in matching APIs or scoring logic. There is no matching UI; the feature is deferred, not cancelled.

## Workflow conventions

- Commits follow Conventional Commits: `<type>(<scope>): <desc>`, lowercase imperative, no period. Scopes: `inventory · suppliers · matching · orders · logistics · dashboard · ui · nav · layout · api · config · docs`.
- Coordinate before changing API response shapes — frontend and backend are built against `docs/API_CONTRACTS.md` in parallel.
- Keep first implementations simple; avoid overengineering before the workflow is settled.

## Branching & Deployment

- **Production:** Vercel project `linko` serves the Vite frontend and the Express API (`api/index.js`, `vercel.json` rewrites) on `linko.nateponds.com`. Pushes to `main` deploy production. **Vercel deployments do not run migrations or seeds.** The GitHub Actions workflow `.github/workflows/migrate.yml` (on `main`) applies new migrations to Supabase when a push to `main` changes `backend/migrations/**`; nothing runs seeds. See `docs/VERCEL_DEPLOYMENT.md`. The self-hosted Docker/cloudflared stack (`docker-compose.yml`) is legacy and deploys nothing.
- **Previews:** every branch push gets a Vercel Preview deployment. Whether previews reach Supabase depends on the `DATABASE_URL` scope in Vercel settings.
- **Staging:** `staging` is a short-lived integration branch for **database changes only** (migrations, `schema.sql`, seeds, dependent routes). It has no hosted database; developers test it against their own **local** Postgres. Migration numbers are taken from `staging`. UI/UX and other non-database work goes `dev/<name>` → `main`.
- **Database:** **Production uses managed Supabase Postgres** (SSL required — the pool in `backend/src/db.js` enables TLS when the URL has `sslmode=*`). There is no hosted staging database and no local prod Postgres.
