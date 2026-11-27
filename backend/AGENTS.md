# Backend Agent Guide (`backend/`)

Scoped rules for the Express 5 + PostgreSQL API in `backend/`. Also follow root `AGENTS.md`, `CODING_STANDARDS.md`, and `docs/API_CONTRACTS.md`.

## Runtime & Database Access

- Express 5 + raw `pg.Pool` managed solely through `backend/src/db.js` (`createPool`). Never import `pg` directly in routes or services.
- Run backend checks with `npm run test:backend` from root (or `npm test` inside `backend/`).

## Shared HTTP Error Helpers

- Use `backend/src/lib/httpErrors.js` (`createHttpError`, `asClientError`, `readSingletonQueryString`) for validation, query parsing, and error normalization instead of hand-rolling ad-hoc status objects.
- Keep `backend/src/middleware/errorHandler.js` as the single error response serializer.

## Auth, RBAC & Multi-Tenant Ownership

- Postgres has **zero RLS** — every protected route enforces access in code.
- Always compose `requireAuth` + `requireAnyRole` (or `requireGlobalRole`) + `getActiveMembership(req, roles)` using `X-Active-Business`.
- Never write inline role string checks in handlers and never add implicit `platform_admin` bypasses.
- Return a uniform `404` on unauthorized single-resource reads so callers cannot enumerate cross-tenant IDs.

## Logistics Confidentiality & Routing

- Split logistics endpoints live under `backend/src/routes/logistics/` (do not regrow a single monolithic `logistics.js`).
- Strip `declared_value` and `shipping_fee` from parcel payloads for non-party viewers.
- Truncate buyer-visible tracking history before return-leg events so buyers do not see internal return-to-sender routing details.
