-- 030_drop_users_role.sql - remove the legacy user role.
ALTER TABLE users DROP COLUMN role;
