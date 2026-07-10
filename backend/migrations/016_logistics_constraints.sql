-- Course-deliverable logistics: correctness constraints follow-up.
--
-- (a) parcels.parcel_id was generated app-side as `LKO-${Date.now()...}`,
-- which collides under concurrent bookings. A DB sequence makes parcel IDs
-- collision-proof; seed it past any existing timestamp-derived suffix so
-- newly minted IDs never collide with rows created before this migration.
--
-- (b) branches.branch_name UNIQUE (migration 002) blocks re-adding a branch
-- name after its row was soft-deleted (migration 015 added is_active).
-- Replace the whole-table uniqueness with a partial index scoped to active
-- rows, so a name is only unique among currently-active branches.
--
-- (c) couriers.user_id (migration 008) had no uniqueness guard: the same
-- platform user could be linked to more than one active courier row. Scope
-- to active rows for the same soft-delete reason as (b).
--
-- (d) tracking_logs.courier_id (migration 002) had no index; courier-scoped
-- lookups (e.g. a courier's assigned parcels) were doing full scans.

CREATE SEQUENCE IF NOT EXISTS parcel_id_seq;
-- Seed past any existing timestamp-derived LKO- suffixes so new IDs never collide.
SELECT setval('parcel_id_seq', GREATEST(
  COALESCE((SELECT MAX(SUBSTRING(parcel_id FROM 'LKO-(\d{8})')::BIGINT) FROM parcels WHERE parcel_id ~ '^LKO-\d{8}$'), 0),
  1
));

ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_branch_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_name_active ON branches (branch_name) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_couriers_user_active ON couriers (user_id) WHERE user_id IS NOT NULL AND is_active;

CREATE INDEX IF NOT EXISTS idx_tracking_courier ON tracking_logs (courier_id);
