# Database Migrations Guide (`backend/migrations/`)

Scoped rules for PostgreSQL migrations in `backend/migrations/`. Also follow root `AGENTS.md` and `docs/linko_database_specification.md`.

## Immutability & Numbering

- **Never edit applied migrations (`001..031`).** Every schema change must be a new, forward-only `.sql` file.
- **Check the next sequence number from `staging`** (not `main`) before naming a new migration so concurrent authors do not collide.
- Apply locally via `npm --prefix backend run migrate` with `DATABASE_URL` set. On push to `main`, `.github/workflows/migrate.yml` auto-applies new files to Supabase.

## Schema Sync & Data Invariants

- **Keep `backend/schema.sql` in sync** with every migration, including constraints, partial unique indexes, and triggers (such as `027_admin_no_memberships.sql`).
- **Never write to legacy `user_businesses`.** Use canonical `business_memberships` for user-to-business associations.
- Preserve single-role business invariants (`buyer` OR `wholesaler`, never both) and `platform_admin` membership separation.

## Branch Discipline

- **Do not add DDL on feature branches unless explicitly approved.** Database changes (migrations, `schema.sql`, seeds, and dependent routes) target the `staging` integration branch and must pass local `npm --prefix backend run migrate && npm run test:backend` before merging to `main`.
