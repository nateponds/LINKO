# LINKO Coding Standards

Engineering standards and review criteria for LINKO.
Mechanical rules live in `eslint.config.js`, database constraints, and automated tests; this document captures the **judgment calls, architectural boundaries, and domain idioms** enforced during code review (`/code-review`).

> **Ratchet Rule**
>
> Standards apply to all **new code** and **modified hunks**. Do not opportunistically rewrite unrelated legacy monoliths (`backend/src/routes/logistics.js`, `backend/src/routes/orders.js`, `src/pages/InventoryPage.jsx`, `src/pages/logistics/LogisticsManagementPage.jsx`, `backend/src/app.test.js`) unless explicitly scoped. Extract new behavior into focused modules, services, feature components, or domain test files so legacy files stop growing.

---

## Reference Patterns

Prefer the idioms established in these modules when adding new code:

- **Frontend API & RBAC:** `src/lib/api.js`, `src/auth/roleAccess.js`
- **Frontend composition & hooks:** `src/pages/SettingsPage.jsx`, `src/hooks/usePaginatedResource.js`, `src/hooks/useListUrlState.js`, `src/hooks/useDebouncedValue.js`
- **Pure frontend logic + tests:** `src/lib/pagination.js`, `src/lib/statusWorkflow.js` (and colocated `*.test.js`)
- **Backend routes & services:** `backend/src/routes/inventoryBatches.js`, `backend/src/routes/suppliers.js`, `backend/src/services/pagination.js`
- **Auth, ownership & error handling:** `backend/src/middleware/auth.js`, `backend/src/middleware/ownership.js`, `backend/src/middleware/errorHandler.js`
- **Backend integration tests:** `backend/src/inventory-batches.test.js`

---

## 1. Architecture & Dependency Discipline

- **Plain ESM JavaScript only.** No TypeScript migration, ORM, schema-validation library (`zod`/`joi`), HTTP client (`axios`), or state manager unless explicitly approved. Extend LINKO's existing lightweight helpers (`ownership.js`, `services/pagination.js`, `src/lib/api.js`) instead of introducing parallel abstractions.
- **Push domain logic into pure modules.** Non-trivial transitions, ranking, routing, filtering, and formatting belong in pure `.js` modules decoupled from React and Express so they stay trivially unit-testable.
- **Prevent new monoliths.** Keep new pages, components, and route modules focused (~`< 300` lines). Split cohesive sub-components or services before a module accumulates multiple responsibilities.
- **Comments explain *why*, not *what*.** Use `// ponytail:` for deliberate, temporary trade-offs with the assumption and revisit trigger clearly stated.

---

## 2. Frontend (React 19 + JSX)

### 2.1 API Access & Layering
- **Route all LINKO API traffic through `src/lib/api.js`** (`apiGet` / `apiSend`) so `credentials: "same-origin"`, `X-Active-Business`, `204` handling, and `{ error: { message } }` errors stay consistent *(raw `fetch` is blocked by ESLint outside API/auth clients)*.
- **Respect folder boundaries:**
  - `src/components/ui/`: generic, domain-agnostic primitives driven purely by props *(imports from `features/` and `lib/api.js` are blocked by ESLint)*.
  - `src/features/<domain>/`: domain widgets, forms, tables, and pure helpers.
  - `src/pages/<Name>Page.jsx`: thin route composition wiring `AppLayout`, hooks, and feature components.
  - `src/layouts/` & `src/components/navigation/`: shared shell chrome only.

### 2.2 RBAC Consistency
- Keep route guards and in-page capabilities centralized in `ROUTE_ACCESS` and `ACTION_ACCESS` in `src/auth/roleAccess.js`. Never duplicate role arrays in pages or nav components.
- `platform_admin` passes **only** where explicitly named; never assume an implicit admin bypass.

### 2.3 State, Effects & Rendering Smells
- **Reuse existing list primitives.** Paginated/searchable views should build on `useListUrlState`, `usePaginatedResource`, and `useDebouncedValue` rather than bespoke `useEffect` fetch state machines.
- **Guard every async effect.** Custom fetch effects must pass an `AbortController` `signal`, ignore `AbortError`, and prevent stale responses from overwriting newer state.
- **Derive state during render.** Flag `useEffect` chains that merely copy props or recompute derived values into `useState`.
- **Stable list keys.** Never use array indices as `key` props on dynamic, filterable, or reorderable lists; use entity IDs (`product_id`, `order_id`, `batch_id`).

### 2.4 Styling & Accessibility
- Global shell styles live in `src/assets/css/shell.css`; page/feature CSS is co-located with scoped class prefixes to avoid global collisions.
- Use `<button type="button">` for non-submit controls, explicit `<label>` associations, `role="alert"` for error states, and `prefers-reduced-motion` support for animations.

---

## 3. Backend (Express 5 + Raw `pg`)

### 3.1 Auth, RBAC & Active-Business Tenancy
- Every protected route must have explicit `requireAuth` plus role middleware (`requireAnyRole` or `requireGlobalRole`), either at mount time in `backend/src/app.js` or per-route.
- **Enforce active-business scoping server-side.** Roles on unselected businesses grant nothing. Always resolve tenancy through `getActiveMembership(req, roles)`, `activeMemberships(req)`, or `resolveActiveBusinessId(req)` from `backend/src/middleware/ownership.js`.
- Never authorize against raw `req.auth.memberships`, never trust a client-supplied `business_id` for ownership or writes, and remember `platform_admin` holds no business memberships (migration `027_admin_no_memberships.sql`) and has no implicit bypass.

### 3.2 Route vs. Service Separation
- `backend/src/routes/`: HTTP boundary only — input parsing/validation, authz/ownership checks, orchestration, and response serialization.
- `backend/src/services/`: reusable domain logic, calculations, routing, pagination, and notifications with zero Express `req`/`res` coupling.

### 3.3 SQL, Transactions & Timezone
- **Use the shared pool in `backend/src/db.js`** (`query()` / `getPool()`) *(direct `pg` imports in routes/services are blocked by ESLint)*.
- **Parameterized queries only (`$1, $2, ...`).** Never interpolate untrusted values into SQL. Dynamic `ORDER BY` clauses or identifiers must resolve through an explicit allowlist.
- **Wrap multi-write or read-then-write invariants in a transaction:** acquire a client via `getPool().connect()`, run `BEGIN` / `COMMIT` / `ROLLBACK`, and always `client.release()` in `finally`.
- **Philippine business calendar:** Managed Supabase sessions run in UTC. Use `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date` instead of bare `CURRENT_DATE` for business-date comparisons.

### 3.4 Pagination, Contracts & Errors
- Reuse `parsePaginationQuery` and `buildPaginatedResponse` from `backend/src/services/pagination.js` for paginated endpoints.
- Keep JSON payloads aligned with `docs/API_CONTRACTS.md` and coordinate frontend/backend shape changes together.
- Surface HTTP errors via `createHttpError(statusCode, message)` passed to `next(error)` so `backend/src/middleware/errorHandler.js` owns the `{ error: { message } }` envelope. Map expected PG constraint codes (`23505`, `23503`, `23514`) to `400`/`409` with clear messages; never leak stack traces, SQL, or credentials.

---

## 4. Plain-JS Boundary Safety

Without TypeScript, boundary discipline carries the type-safety load:

- **Reject repeated query keys (arrays).** Express turns `?k=a&k=b` into arrays; verify `typeof value === "string"` before parsing or trimming query params.
- **Validate IDs strictly, including Postgres 32-bit `INT` bounds.** Reject non-digits, unsafe integers, and IDs `> 2147483647` on `INT`/`SERIAL` columns so invalid filters return `400`/`404` instead of PG `22003` (`500`).
- **Reuse `ownership.js` validators** (`requireFields`, `requirePositiveInt`, `requireEmail`) and fail closed against explicit allowlists for enums, sort keys, and `YYYY-MM-DD` calendar dates.
- **Use `??` (not `||`) for defaults** wherever `0` or `false` is a valid value.

---

## 5. Database & Migrations

- Take the next sequential migration number from `staging` (`backend/migrations/NNN_description.sql`).
- Encode critical invariants in SQL (`CHECK`, foreign keys, partial unique indexes like `one_marketplace_role_per_business`), not only in JavaScript.
- Update `docs/linko_database_specification.md` when schema changes.
- Never run DDL at app startup — Vercel does not execute migrations (`.github/workflows/migrate.yml` runs on `main`).

---

## 6. Testing

- **Frontend / pure helpers (`npm test`):** Colocate fast, deterministic `*.test.js` unit tests using `node:test` and `node:assert/strict`.
- **Backend (`npm run test:backend`):** Add focused domain test files (`backend/src/<feature>.test.js`); do not pile new suites into `backend/src/app.test.js`. Guard DB-dependent tests with `{ skip: !hasDb }`.
- **Protected endpoint baseline:** Cover unauthenticated (`401`), unauthorized role / wrong `X-Active-Business` (`403`), malformed/out-of-range input (`400`/`404`), and happy-path contract + persistence.
- **Assert behavior, not internals.** Prefer real HTTP contract assertions and pure helper outputs over brittle mocks.
