-- Course-deliverable logistics: soft-delete flag for branches and couriers.
--
-- Deleting reference data hard would retroactively blank branch/courier names
-- in existing parcel tracking history (FKs are ON DELETE SET NULL). A soft flag
-- hides them from the management lists while preserving that history intact.
--
-- Follows the users.is_active precedent (migration 011). Defaults TRUE so all
-- existing rows stay visible. Guarded with IF NOT EXISTS for safe replay.

ALTER TABLE branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE couriers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
