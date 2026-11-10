-- 027_admin_no_memberships.sql - a platform_admin never holds a business
-- membership. Admins are governance + logistics override only, never a
-- marketplace/business identity; admin isolation in the authz layer relies on
-- this. The rule spans users and business_memberships, so a trigger enforces it.
-- Numbered 027 because staging already carries 026_inventory_batches.sql.

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

CREATE FUNCTION enforce_admin_no_memberships() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'business_memberships' THEN
        IF EXISTS (SELECT 1 FROM users
                    WHERE user_id = NEW.user_id AND global_role = 'platform_admin') THEN
            RAISE EXCEPTION 'platform_admin user % cannot hold a business membership', NEW.user_id
                USING ERRCODE = 'check_violation', CONSTRAINT = 'admin_no_memberships';
        END IF;
    ELSIF NEW.global_role = 'platform_admin'
      AND EXISTS (SELECT 1 FROM business_memberships WHERE user_id = NEW.user_id) THEN
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
