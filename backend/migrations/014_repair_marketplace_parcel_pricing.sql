-- Marketplace checkout knows the frozen goods subtotal and selected service
-- tier, but does not collect physical parcel weight or route distance. Repair
-- linked parcels that were billed from placeholder measurements with a zero
-- declared value. Standalone logistics bookings retain trigger-based pricing.

WITH marketplace_pricing AS (
    SELECT p.parcel_id,
           COALESCE(SUM(oi.quantity * oi.unit_price_snapshot), 0) AS declared_value,
           COALESCE(MAX(st.base_fee), 0) AS shipping_fee
      FROM parcels p
      JOIN orders o ON o.order_id = p.order_id
      LEFT JOIN order_items oi ON oi.order_id = o.order_id
      LEFT JOIN service_tiers st ON st.tier_id = o.tier_id
     WHERE p.order_id IS NOT NULL
     GROUP BY p.parcel_id
)
UPDATE parcels p
   SET declared_value = pricing.declared_value,
       shipping_fee = pricing.shipping_fee
  FROM marketplace_pricing pricing
 WHERE p.parcel_id = pricing.parcel_id;

UPDATE payments pay
   SET amount = p.declared_value + COALESCE(p.shipping_fee, 0)
  FROM parcels p
 WHERE pay.parcel_id = p.parcel_id
   AND p.order_id IS NOT NULL;
