-- Auth + RBAC expansion for the existing backend scaffold.
-- 001 already created users / businesses / user_businesses, so this migration
-- adds only the missing auth fields, introduces richer memberships, and keeps
-- the older structures compatible for existing code and data.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS global_role VARCHAR(20);

ALTER TABLE users
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

UPDATE users
   SET full_name = COALESCE(full_name, username)
 WHERE full_name IS NULL;

ALTER TABLE users
    ALTER COLUMN full_name SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'users_global_role_check'
           AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_global_role_check
            CHECK (global_role IS NULL OR global_role = 'platform_admin');
    END IF;
END $$;

UPDATE users
   SET global_role = 'platform_admin'
 WHERE global_role IS NULL
   AND role = 'admin';

CREATE TABLE IF NOT EXISTS business_memberships (
    membership_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    business_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('buyer', 'wholesaler', 'logistics_coordinator', 'courier')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, business_id, role)
);

INSERT INTO business_memberships (user_id, business_id, role)
SELECT ub.user_id, ub.business_id, 'buyer'
  FROM user_businesses ub
  JOIN businesses b ON b.business_id = ub.business_id
 WHERE b.business_type IN ('buyer', 'both')
ON CONFLICT (user_id, business_id, role) DO NOTHING;

INSERT INTO business_memberships (user_id, business_id, role)
SELECT ub.user_id, ub.business_id, 'wholesaler'
  FROM user_businesses ub
  JOIN businesses b ON b.business_id = ub.business_id
 WHERE b.business_type IN ('wholesaler', 'both')
ON CONFLICT (user_id, business_id, role) DO NOTHING;

CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id VARCHAR(128) PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_memberships_business_role
    ON business_memberships (business_id, role);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions (expires_at);
