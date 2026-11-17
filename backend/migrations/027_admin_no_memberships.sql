-- 027_admin_no_memberships.sql - a platform_admin never holds a business
-- membership. Admins are governance + logistics override only, never a
-- marketplace/business identity; admin isolation in the authz layer relies on
-- this. The rule spans users and business_memberships, so a trigger enforces it.
-- Numbered 027 because staging already carries 026_inventory_batches.sql.
--
-- Apply inside one transaction (migrate.js does). The table locks below are
-- held until commit, so no write can slip in between the check and the guard.

-- Same order the app takes them (membership insert, then its users row), so a
-- concurrent writer waits instead of deadlocking.
LOCK TABLE business_memberships, users IN SHARE ROW EXCLUSIVE MODE;

-- Triggers only check new writes. Refuse to apply over existing violations
-- rather than grandfather them; fix the rows by hand, then rerun.
DO $$
DECLARE
    offenders TEXT;
BEGIN
    SELECT string_agg(DISTINCT u.user_id || ' <' || u.email || '>', ', ')
      INTO offenders
      FROM users u
      JOIN business_memberships bm ON bm.user_id = u.user_id
     WHERE u.global_role = 'platform_admin';
    IF offenders IS NOT NULL THEN
        RAISE EXCEPTION 'platform_admin users hold business memberships: %', offenders;
    END IF;
END $$;

-- Concurrency: both sides must write the same users row, or a membership
-- insert and a promotion in two open transactions each miss the other's
-- uncommitted row and both commit. A row lock alone is not enough: under
-- REPEATABLE READ a waiter that acquires a lock released by a lock-only holder
-- proceeds on its old snapshot. A real (no-op) UPDATE makes the loser either
-- re-check the committed row (READ COMMITTED) or fail with 40001 (REPEATABLE
-- READ / SERIALIZABLE). Only NEW.user_id matters on a reassignment: moving a
-- membership away from a user cannot create a violation.
CREATE FUNCTION enforce_admin_no_memberships() RETURNS trigger AS $$
DECLARE
    owner_role TEXT;
BEGIN
    IF TG_TABLE_NAME = 'business_memberships' THEN
        UPDATE users SET global_role = global_role
         WHERE user_id = NEW.user_id
        RETURNING global_role INTO owner_role;
        IF owner_role = 'platform_admin' THEN
            RAISE EXCEPTION 'platform_admin user % cannot hold a business membership', NEW.user_id
                USING ERRCODE = 'check_violation', CONSTRAINT = 'admin_no_memberships';
        END IF;
    ELSIF NEW.global_role = 'platform_admin'
      AND EXISTS (SELECT 1 FROM business_memberships WHERE user_id = NEW.user_id) THEN
        -- The UPDATE fired this trigger after locking the row, so under READ
        -- COMMITTED this query's fresh snapshot sees any membership whose
        -- insert held that lock first.
        RAISE EXCEPTION 'user % holds business memberships and cannot become platform_admin', NEW.user_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'admin_no_memberships';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER business_memberships_admin_guard
    BEFORE INSERT OR UPDATE ON business_memberships
    FOR EACH ROW EXECUTE FUNCTION enforce_admin_no_memberships();

CREATE TRIGGER users_admin_guard
    BEFORE UPDATE OF global_role ON users
    FOR EACH ROW EXECUTE FUNCTION enforce_admin_no_memberships();
