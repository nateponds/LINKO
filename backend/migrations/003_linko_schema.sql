-- Aligns the logistics subsystem (002) with the finalized schema in
-- docs/linko_database_specification.md. 002 already shipped, so the delta lives here.
--
-- What changes:
--   service_tiers   + base_fee, + rate_per_km (richer pricing formula)
--   parcels         total_cost -> shipping_fee (it always was the delivery
--                   charge); + declared_value (goods price, remittance input)
--   payments        amount becomes the buyer's TOTAL (declared_value +
--                   shipping_fee), widened to DECIMAL(12,2), set by trigger
--   commissions     NEW: LINKO's flat per-parcel cut from the wholesaler,
--                   bracketed by weight (commission_brackets)
--   wholesaler_remittances  NEW view: what the wholesaler nets after the cut

-- Pricing knobs for the richer shipping-fee formula. Existing tiers backfill
-- at 0 (their fees unchanged); the default is then dropped so new tiers must
-- be priced explicitly.
ALTER TABLE service_tiers
    ADD COLUMN base_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN rate_per_km DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE service_tiers
    ALTER COLUMN base_fee DROP DEFAULT,
    ALTER COLUMN rate_per_km DROP DEFAULT;

-- total_cost only ever held the trigger-computed delivery charge, so rename
-- it to what it is. The buyer's real total (goods + shipping) moves to
-- payments.amount below -- storing it on parcels too would be redundancy.
DROP TRIGGER trg_set_parcel_total_cost ON parcels;
DROP FUNCTION fn_set_parcel_total_cost();
ALTER TABLE parcels RENAME COLUMN total_cost TO shipping_fee;

-- Goods price the buyer pays the wholesaler; 0 = undeclared (like real
-- courier declaration forms). Input to the remittance view.
ALTER TABLE parcels
    ADD COLUMN declared_value DECIMAL(12,2) NOT NULL DEFAULT 0
        CHECK (declared_value >= 0);

-- shipping_fee is derived (tier base fee + weight_kg x tier rate +
-- distance_km x tier per-km rate) but stored, so historical pricing survives
-- future service_tiers rate changes. Populate on insert; only compute when
-- the caller did not supply a value, so backfills and manual overrides still
-- win. Distance may be null (not yet measured) -> its component contributes
-- zero.
CREATE FUNCTION fn_set_parcel_shipping_fee()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.shipping_fee IS NULL THEN
        SELECT st.base_fee
               + NEW.weight_kg * st.base_rate_per_kg
               + COALESCE(NEW.total_distance_km, 0) * st.rate_per_km
          INTO NEW.shipping_fee
          FROM service_tiers st
         WHERE st.tier_id = NEW.tier_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_parcel_shipping_fee
BEFORE INSERT ON parcels
FOR EACH ROW
EXECUTE FUNCTION fn_set_parcel_shipping_fee();

-- payments.amount is now the buyer's TOTAL outlay: declared_value (goods)
-- + shipping_fee (delivery), frozen from the parcel at booking time.
-- Existing rows already satisfy the new meaning: they held the shipping fee
-- and their parcels backfill declared_value = 0, so fee + 0 = fee.
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(12,2);

CREATE FUNCTION fn_set_payment_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.amount IS NULL THEN
        SELECT p.declared_value + COALESCE(p.shipping_fee, 0)
          INTO NEW.amount
          FROM parcels p
         WHERE p.parcel_id = NEW.parcel_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_payment_amount
BEFORE INSERT ON payments
FOR EACH ROW
EXECUTE FUNCTION fn_set_payment_amount();

-- LINKO's cut: flat commission per parcel, charged to the wholesaler
-- (parcels.sender_id), varying by weight bracket.
-- Brackets: min inclusive, max exclusive; NULL max = no upper cap.
CREATE TABLE commission_brackets (
    bracket_id SERIAL PRIMARY KEY,
    min_weight_kg DECIMAL(6,2) NOT NULL,
    max_weight_kg DECIMAL(6,2),
    fee DECIMAL(10,2) NOT NULL
);

-- One commission per parcel (1:1), auto-created by AFTER INSERT trigger.
-- amount is frozen from the bracket fee at ship time (same rationale as
-- parcels.shipping_fee: future bracket changes must not rewrite history).
-- Payer = parcels.sender_id, so no duplicate wholesaler FK here.
CREATE TABLE commissions (
    commission_id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(20) NOT NULL UNIQUE REFERENCES parcels(parcel_id) ON UPDATE CASCADE ON DELETE CASCADE,
    bracket_id INT NOT NULL REFERENCES commission_brackets(bracket_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'Collected')),
    settled_at TIMESTAMP
);

-- Every parcel owes LINKO a commission: AFTER INSERT, pick the weight
-- bracket and freeze its fee. If no bracket covers the weight, no row is
-- created (seed brackets 0..NULL to guarantee full coverage).
CREATE FUNCTION fn_create_parcel_commission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO commissions (parcel_id, bracket_id, amount)
    SELECT NEW.parcel_id, cb.bracket_id, cb.fee
      FROM commission_brackets cb
     WHERE NEW.weight_kg >= cb.min_weight_kg
       AND (cb.max_weight_kg IS NULL OR NEW.weight_kg < cb.max_weight_kg);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_parcel_commission
AFTER INSERT ON parcels
FOR EACH ROW
EXECUTE FUNCTION fn_create_parcel_commission();

-- What the wholesaler actually nets: buyer pays declared_value for the goods,
-- LINKO keeps its commission, wholesaler is remitted the rest. Both inputs
-- are frozen at ship time (declared_value on the parcel, amount on the
-- commission), so the remittance is pure arithmetic -> a view, not a table.
CREATE VIEW wholesaler_remittances AS
SELECT p.parcel_id,
       p.sender_id                 AS wholesaler_id,
       p.declared_value            AS gross_amount,
       c.amount                    AS commission,
       p.declared_value - c.amount AS net_amount
  FROM parcels p
  JOIN commissions c ON c.parcel_id = p.parcel_id;
