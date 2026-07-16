-- Milestone 5: uniform created_at across the marketplace tables that were
-- missing it, plus updated_at on the two tables the app mutates in place
-- (products via PATCH, invoices reserved for future edits).
--
-- Scope guard: this touches ONLY marketplace/001 tables. The 002/003 course
-- deliverable tables (service_tiers, branches, couriers, parcels, payments,
-- tracking_logs) are the logistics context and are intentionally left untouched.
--
-- Every statement is IF NOT EXISTS / IF EXISTS guarded so a manual replay
-- against an already-migrated database is harmless.

ALTER TABLE user_businesses  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE addresses        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE warehouses       ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE categories       ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
