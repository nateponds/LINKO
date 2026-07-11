-- ==========================================================================
-- 017_phaseout_both_role.sql
-- Sprint 9: drop the "one business is both buyer AND wholesaler" combination.
--
-- This migration is destructive to the both-role data model:
--   1. For each (user_id, business_id) that currently holds BOTH a buyer and a
--      wholesaler membership, keep the wholesaler row (the higher-capability
--      side) and delete the buyer row. This is the documented Sprint 9 rule:
--      when an existing both-business must collapse to one marketplace role,
--      it collapses to wholesaler (it keeps products, warehouses, and the
--      supplier listing). Buyers who need to keep buying must re-register as a
--      separate buyer business.
--   2. Reclassify every business_type='both' business to 'wholesaler' so the
--      new CHECK constraint (without 'both') can be applied.
--   3. Replace the businesses.business_type CHECK constraint with one that no
--      longer accepts 'both'.
--   4. Add a partial UNIQUE index on (user_id, business_id) for marketplace
--      roles so the same user-business pair can never again hold both buyer
--      and wholesaler roles. (Logistics coordinator / courier are unaffected;
--      a wholesaler who is also a courier for their own business is still
--      allowed.)
--
-- The seed (backend/seeds/dev_seed.sql) is updated separately to no longer
-- create 'both' businesses; this migration is for existing databases.
-- ==========================================================================

BEGIN;

-- 1. Collapse both-role memberships: keep 'wholesaler', drop 'buyer'.
DELETE FROM business_memberships bm_buyer
USING business_memberships bm_wholesaler
WHERE bm_buyer.user_id = bm_wholesaler.user_id
  AND bm_buyer.business_id = bm_wholesaler.business_id
  AND bm_buyer.role = 'buyer'
  AND bm_wholesaler.role = 'wholesaler';

-- 2. Reclassify businesses.business_type = 'both' -> 'wholesaler'.
UPDATE businesses
   SET business_type = 'wholesaler'
 WHERE business_type = 'both';

-- 3. Replace the businesses.business_type CHECK constraint.
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_business_type_check;

ALTER TABLE businesses
  ADD CONSTRAINT businesses_business_type_check
  CHECK (business_type IN ('buyer', 'wholesaler', 'individual', 'msme', 'corporation', 'other'));

-- 4. Partial unique index: one marketplace role per (user, business).
CREATE UNIQUE INDEX IF NOT EXISTS one_marketplace_role_per_business
  ON business_memberships (user_id, business_id)
  WHERE role IN ('buyer', 'wholesaler');

COMMIT;
