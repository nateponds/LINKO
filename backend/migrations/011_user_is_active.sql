-- Milestone 6: user activation flag for platform-admin account management.
--
-- A deactivated user cannot log in and any existing sessions are killed (both
-- eagerly by the admin route deleting their auth_sessions and defensively by
-- the session lookup filtering on is_active). Defaults TRUE so every existing
-- account stays active after this migration.
--
-- Guarded with IF NOT EXISTS so a manual replay is harmless.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
