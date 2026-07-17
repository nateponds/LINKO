-- ==========================================================================
-- 022_couriers_single_org.sql
-- Path Y1: every courier belongs to ONE canonical LINKO logistics org.
--
-- The couriers table has no business_id -- a courier is a person anchored to
-- a branch (assigned_branch_id) and a login (user_id). But RBAC gates courier
-- permission on a business_memberships row with role='courier', and that row
-- needs *a* business_id. The seed satisfied this by inventing a fake solo
-- 'individual' business per courier ('Cory Express Delivery', 'Carlo Quick
-- Haul'). The check only asks "is there a courier membership?", never *which*
-- business, so those per-driver businesses were pure noise.
--
-- This migration:
--   1. Widens the businesses.business_type CHECK to admit 'logistics'. A
--      logistics org is not a marketplace actor (never in supplier discovery,
--      never places an order), so it needs a name of its own rather than the
--      residual 'other' bucket -- which 'LINKO Platform' also occupies.
--   2. Renames 'LINKO Logistics Hub' -> 'LINKO Logistics' and retypes it to
--      'logistics'. This is the coordinator's existing org; couriers join it.
--   3. Repoints every courier membership at that canonical org.
--   4. Deletes the two fake courier businesses, children before parents.
--
-- couriers.user_id points at the USER, not the business, so dropping the
-- courier businesses never touches the couriers table.
--
-- The canonical org is resolved by business_name everywhere -- prod ids differ
-- from seed ids, so no business_id is hardcoded. Every statement is a no-op on
-- an already-migrated DB (migrate.js has no checksumming; the DB may have been
-- hand-fixed).
--
-- The seed (backend/seeds/dev_seed.sql) is updated separately to create the
-- canonical org directly; this migration is for existing databases.
-- ==========================================================================

BEGIN;

-- 1. Widen the CHECK constraint to admit 'logistics'.
--    Must precede step 2, or the retype UPDATE violates the old constraint.
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_business_type_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_business_type_check
  CHECK (business_type IN ('buyer', 'wholesaler', 'individual', 'msme', 'corporation', 'other', 'logistics'));

-- 2. Rename + retype the canonical org. The IN () makes it re-runnable: on a
--    second run the row already reads 'LINKO Logistics' and still matches.
UPDATE businesses
   SET business_name = 'LINKO Logistics',
       business_type = 'logistics'
 WHERE business_name IN ('LINKO Logistics Hub', 'LINKO Logistics');

-- 3. Repoint every courier membership at the canonical org.
UPDATE business_memberships
   SET business_id = (SELECT business_id FROM businesses WHERE business_name = 'LINKO Logistics')
 WHERE role = 'courier';

-- 4. Drop the fake courier businesses, children before parents. Scoped by the
--    two seed names -- never by business_type='individual', which would nuke a
--    real individual business a human added later.
DELETE FROM business_memberships
 WHERE business_id IN (
   SELECT business_id FROM businesses
    WHERE business_name IN ('Cory Express Delivery', 'Carlo Quick Haul')
 );

DELETE FROM user_businesses
 WHERE business_id IN (
   SELECT business_id FROM businesses
    WHERE business_name IN ('Cory Express Delivery', 'Carlo Quick Haul')
 );

DELETE FROM addresses
 WHERE business_id IN (
   SELECT business_id FROM businesses
    WHERE business_name IN ('Cory Express Delivery', 'Carlo Quick Haul')
 );

DELETE FROM businesses
 WHERE business_name IN ('Cory Express Delivery', 'Carlo Quick Haul');

COMMIT;
