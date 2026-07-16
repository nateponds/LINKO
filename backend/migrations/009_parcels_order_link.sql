-- Courier workflow (docs/API_CONTRACTS.md §3): link marketplace
-- orders to their auto-created parcels so a courier's 'Delivered' scan can
-- complete the order. Nullable -- standalone course-deliverable bookings
-- (BookParcel flow) have no order. Deliberate, documented crossing of the
-- course/marketplace boundary.
ALTER TABLE parcels
    ADD COLUMN order_id INT REFERENCES orders(order_id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcels_order
    ON parcels (order_id);

-- Courier accounts are provisioned by admins without a phone number.
ALTER TABLE couriers ALTER COLUMN phone_number DROP NOT NULL;

-- One-off relink: admin-created courier users predating this change have no
-- couriers row link. Match by name against users holding a courier
-- membership; harmless no-op when nothing matches.
UPDATE couriers c
   SET user_id = u.user_id
  FROM users u
  JOIN business_memberships bm ON bm.user_id = u.user_id AND bm.role = 'courier'
 WHERE c.user_id IS NULL
   AND lower(u.full_name) = lower(c.full_name);
