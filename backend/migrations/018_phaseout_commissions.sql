-- Phase out commissions & remittances entirely. These were a self-added ERD
-- extra (003), never part of the graded CIS 2104 core tables, and never seeded
-- (commission_brackets was empty, so the trigger created zero commission rows).
--
-- Removed: the wholesaler_remittances view, the AFTER INSERT commission trigger
-- and its function, and the commissions + commission_brackets tables.
--
-- Kept: parcels.declared_value (cart goods total) and payments.amount
-- (= declared_value + shipping_fee). Those are the buyer money story and stand
-- on their own -- they never depended on commissions existing.
--
-- Drop order follows the dependency chain: view -> trigger -> function ->
-- commissions (FK to brackets) -> commission_brackets.

DROP VIEW IF EXISTS wholesaler_remittances;
DROP TRIGGER IF EXISTS trg_create_parcel_commission ON parcels;
DROP FUNCTION IF EXISTS fn_create_parcel_commission();
DROP TABLE IF EXISTS commissions;
DROP TABLE IF EXISTS commission_brackets;
