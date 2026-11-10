-- 028_users_role_nullable.sql - allow users without a legacy role.
ALTER TABLE users ALTER COLUMN role DROP NOT NULL;
