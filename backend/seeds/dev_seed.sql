-- ==========================================================================
-- LINKO dev_seed.sql — Minimal, readable seed for development.
--
-- Replaces ALL data. Run with:
--   psql $DATABASE_URL -f backend/seeds/dev_seed.sql
--   (or via the Node runner: node seeds/_apply_seed.js)
--
-- Password for every demo account: "password"
-- Hash: scrypt(ln=14,r=8,p=1)
-- ==========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. WIPE — reverse FK order, keep reference tables (service_tiers, categories)
-- ---------------------------------------------------------------------------
TRUNCATE notifications, payments, tracking_logs, parcels,
         invoices, order_items, orders,
         auth_sessions,
         products, warehouses,
         couriers, branches,
         business_memberships, user_businesses,
         addresses, businesses, users
  CASCADE;

-- Reset sequences so IDs start from 1
ALTER SEQUENCE users_user_id_seq RESTART WITH 1;
ALTER SEQUENCE businesses_business_id_seq RESTART WITH 1;
ALTER SEQUENCE addresses_address_id_seq RESTART WITH 1;
ALTER SEQUENCE warehouses_warehouse_id_seq RESTART WITH 1;
ALTER SEQUENCE products_product_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_order_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_order_item_id_seq RESTART WITH 1;
ALTER SEQUENCE invoices_invoice_id_seq RESTART WITH 1;
ALTER SEQUENCE branches_branch_id_seq RESTART WITH 1;
ALTER SEQUENCE couriers_courier_id_seq RESTART WITH 1;
ALTER SEQUENCE business_memberships_membership_id_seq RESTART WITH 1;
ALTER SEQUENCE tracking_logs_log_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_payment_id_seq RESTART WITH 1;
ALTER SEQUENCE notifications_notification_id_seq RESTART WITH 1;

-- A fresh schema contains no delivery tiers. Keep the stable IDs used by the
-- demo orders and parcels, while making this safe to re-run.
INSERT INTO service_tiers
  (tier_id, tier_name, base_fee, base_rate_per_kg, rate_per_km, estimated_days)
VALUES
  (1, 'Standard', 50.00, 20.00, 2.00, 5),
  (2, 'Express', 90.00, 30.00, 3.00, 2),
  (3, 'Next-Day', 150.00, 40.00, 4.00, 1)
ON CONFLICT (tier_id) DO UPDATE SET
  tier_name = EXCLUDED.tier_name,
  base_fee = EXCLUDED.base_fee,
  base_rate_per_kg = EXCLUDED.base_rate_per_kg,
  rate_per_km = EXCLUDED.rate_per_km,
  estimated_days = EXCLUDED.estimated_days;

SELECT setval('service_tiers_tier_id_seq', 3, true);

-- Shared password hash for all demo accounts — plaintext is "password"
-- Hash: scrypt(ln=14,r=8,p=1)

-- ---------------------------------------------------------------------------
-- 1. USERS (9)
--    5 core role accounts + 1 extra buyer + 1 extra wholesaler
--    + 1 multi-business user (was "both", now bizswitch with 2 businesses)
--    + 1 extra courier
-- ---------------------------------------------------------------------------
INSERT INTO users (username, email, full_name, password_hash, role, global_role) VALUES
  ('buyer_demo',      'buyer@linko.test',      'Bianca Buyer',        '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL),             -- 1
  ('wholesaler_demo', 'wholesaler@linko.test', 'Waldo Wholesaler',   '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'wholesaler', NULL),             -- 2
  ('logistics_demo',  'logistics@linko.test',  'Lia Logistics',      '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL),             -- 3
  ('courier_demo',    'courier@linko.test',    'Cory Courier',       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL),             -- 4
  ('admin_demo',      'admin@linko.test',      'Pia Platform Admin', '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'admin',      'platform_admin'), -- 5
  ('buyer2_demo',     'buyer2@linko.test',     'Ben Buyer Jr',       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL),             -- 6
  ('wholesaler2_demo','wholesaler2@linko.test','Wendy Wholesaler',   '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'wholesaler', NULL),             -- 7
  ('bizswitch_demo',  'bizswitch@linko.test',  'Bo Bizswitch',       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL),             -- 8
  ('courier2_demo',   'courier2@linko.test',   'Carlo Courier',      '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==', 'staff',      NULL);            -- 9

-- ---------------------------------------------------------------------------
-- 2. BUSINESSES (10)
--    One per user, except user 8 (bizswitch) who owns TWO businesses
--    (one buyer, one wholesaler) -- exercises the business switcher.
--    Sprint 9 (refactor/phaseout-both-role) removed the 'both' business_type;
--    a single business can no longer be both buyer and wholesaler.
-- ---------------------------------------------------------------------------
INSERT INTO businesses (business_name, business_type, contact_number, is_verified) VALUES
  ('Sunrise Retail Cooperative',     'buyer',      '+639170000001', TRUE),   -- 1  buyer_demo
  ('Cebu Fresh Wholesale',           'wholesaler', '+639170000002', TRUE),   -- 2  wholesaler_demo
  ('LINKO Logistics Hub',            'other',      '+639170000003', TRUE),   -- 3  logistics_demo
  ('Cory Express Delivery',          'individual', '+639170000004', FALSE),  -- 4  courier_demo
  ('LINKO Platform',                 'other',      '+639170000005', TRUE),   -- 5  admin_demo
  ('Davao Sari-Sari Mart',           'buyer',      '+639170000006', TRUE),   -- 6  buyer2_demo
  ('Mandaue Agri Supply',            'wholesaler', '+639170000007', TRUE),   -- 7  wholesaler2_demo
  ('Metro Cebu Trading — Retail',    'buyer',      '+639170000008', TRUE),   -- 8  bizswitch_demo (buyer side)
  ('Carlo Quick Haul',               'individual', '+639170000009', FALSE),  -- 9  courier2_demo
  ('Metro Cebu Trading — Wholesale', 'wholesaler', '+639170000010', TRUE);   -- 10 bizswitch_demo (wholesaler side)

-- Link each user to their business(es). User 8 owns two businesses.
INSERT INTO user_businesses (user_id, business_id) VALUES
  (1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,9),(8,10);

-- ---------------------------------------------------------------------------
-- 3. BUSINESS_MEMBERSHIPS — role-based access
--    Sprint 9: one marketplace role per (user, business). User 8 holds buyer
--    on business 8 and wholesaler on business 10 -- two distinct businesses,
--    never two roles on the same business.
-- ---------------------------------------------------------------------------
INSERT INTO business_memberships (user_id, business_id, role) VALUES
  (1, 1, 'buyer'),
  (2, 2, 'wholesaler'),
  (3, 3, 'logistics_coordinator'),
  (4, 4, 'courier'),
  -- admin (user 5) has no membership row; access comes from users.role = 'admin'
  (6, 6, 'buyer'),
  (7, 7, 'wholesaler'),
  (8, 8,  'buyer'),       -- bizswitch_demo acting as buyer
  (8, 10, 'wholesaler'),  -- bizswitch_demo acting as wholesaler
  (9, 9, 'courier');

-- ---------------------------------------------------------------------------
-- 4. ADDRESSES
--    2 per wholesaler business (2,7), 1 per everyone else, +1 ownerless branch
-- ---------------------------------------------------------------------------
INSERT INTO addresses (business_id, province, city_municipality, barangay, street_address, postal_code) VALUES
  -- Business 1 (Sunrise Retail — buyer)
  (1, 'Cebu',   'Cebu City',    'Lahug',      '123 Salinas Dr',        '6000'),    -- 1
  -- Business 2 (Cebu Fresh Wholesale) — 2 addresses
  (2, 'Cebu',   'Cebu City',    'Mabolo',     '45 AS Fortuna St',      '6000'),    -- 2  main office
  (2, 'Cebu',   'Cebu City',    'Banilad',    '88 Gov. Cuenco Ave',    '6000'),    -- 3  warehouse loc
  -- Business 3 (LINKO Logistics Hub)
  (3, 'Cebu',   'Cebu City',    'Subangdaku', '10 Ouano Ave',          '6000'),    -- 4
  -- Business 4 (Cory Express — courier)
  (4, 'Cebu',   'Mandaue City', 'Centro',     '5 Mantawi Intl Dr',     '6014'),    -- 5
  -- Business 5 (LINKO Platform — admin)
  (5, 'Cebu',   'Cebu City',    'Lahug',      'Cebu IT Park Tower 1',  '6000'),    -- 6
  -- Business 6 (Davao Sari-Sari — buyer2)
  (6, 'Davao del Sur', 'Davao City', 'Poblacion', '77 Roxas Ave',      '8000'),    -- 7
  -- Business 7 (Mandaue Agri Supply) — 2 addresses
  (7, 'Cebu',   'Mandaue City', 'Tipolo',     '32 Plaridel St',        '6014'),    -- 8  main office
  (7, 'Cebu',   'Mandaue City', 'Casuntingan','Lot 9 NRA Compound',    '6014'),    -- 9  warehouse loc
  -- Business 8 (Metro Cebu Trading — Retail, buyer side of bizswitch_demo)
  (8, 'Cebu',   'Cebu City',    'Guadalupe',  '55 V. Rama Ave',        '6000'),    -- 10
  -- Business 9 (Carlo Quick Haul — courier2)
  (9, 'Cebu',   'Mandaue City', 'Subangdaku', '12 ML Quezon St',       '6014'),    -- 11
  -- Ownerless branch address
  (NULL, 'Cebu','Mandaue City', 'Centro',     'National Highway Hub',  '6014'),    -- 12
  -- Business 10 (Metro Cebu Trading — Wholesale, wholesaler side of bizswitch_demo)
  (10,'Cebu',   'Cebu City',    'Guadalupe',  '55 V. Rama Ave Bldg B', '6000');    -- 13

-- ---------------------------------------------------------------------------
-- 5. WAREHOUSES (3) — one per wholesaler business (2, 7, 10)
-- ---------------------------------------------------------------------------
INSERT INTO warehouses (business_id, warehouse_name, address_id) VALUES
  (2,  'Cebu Fresh Main Warehouse',     3),    -- 1  uses address 3 (Banilad)
  (7,  'Mandaue Agri Cold Storage',     9),    -- 2  uses address 9 (Casuntingan)
  (10, 'Metro Cebu Wholesale Warehouse', 13);   -- 3  uses address 13 (Guadalupe Bldg B)

-- ---------------------------------------------------------------------------
-- 6. PRODUCTS (13) — 6 per primary wholesaler, 5 for the second wholesaler,
--    2 for bizswitch_demo's wholesaler side. All listings are WHOLESALE bulk
--    packages (cases, sacks, crates, trays).
--    Categories: 1=Pork,2=Beef,3=Chicken,4=Chips,5=Fish,
--    6=Shellfish,7=Produce,8=Bakery,9=Dairy,10=Frozen,11=Packaging,12=Beverages
-- ---------------------------------------------------------------------------
INSERT INTO products (business_id, product_name, sku, category_id, description, unit_price, stock_quantity, image_url, is_active) VALUES
  -- Cebu Fresh Wholesale (business 2) — 6 products
  (2, 'Pork Belly — 10kg case',           'CFW-PK001', 1,  '10kg vacuum-sealed pork belly slabs, 4-5 pcs per case',           2800.00, 45,  NULL, TRUE),   -- 1
  (2, 'Beef Ribeye — 5kg case (10 steaks)','CFW-BF001', 2,  '5kg case, 10x 500g USDA-grade ribeye steaks',                     5200.00, 20,  NULL, TRUE),   -- 2
  (2, 'Dressed Chicken — crate of 12',     'CFW-CK001', 3,  'Crate of 12 whole free-range dressed chickens (~1.2kg each)',     2340.00, 60,  NULL, TRUE),   -- 3
  (2, 'Bangus Boneless — 10kg box',        'CFW-FS001', 5,  '10kg box of deboned butterflied milkfish (~20 pcs)',             3300.00, 35,  NULL, TRUE),   -- 4
  (2, 'Tiger Prawns — 5kg styro box',      'CFW-SH001', 6,  '5kg iced styrofoam box, wild-caught tiger prawns',              3400.00, 15,  NULL, TRUE),   -- 5
  (2, 'Carabao Mango — 20kg crate',        'CFW-PR001', 7,  '20kg crate of export-quality Cebu carabao mangoes (~50 pcs)',   2400.00, 80,  NULL, TRUE),   -- 6

  -- Mandaue Agri Supply (business 7) — 5 products
  (7, 'Pandesal — tray of 100 pcs',        'MAS-BK001', 8,  'Tray of 100 freshly baked traditional pandesal rolls',           450.00, 100, NULL, TRUE),   -- 7
  (7, 'Carabao Milk — crate of 12L',       'MAS-DY001', 9,  'Crate of 12x 1L fresh pasteurized carabao milk',                1020.00, 40,  NULL, TRUE),   -- 8
  (7, 'Lumpia Shanghai — 5kg bulk pack',   'MAS-FZ001', 10, '5kg bulk pack frozen pork lumpia shanghai (~200 pcs)',           1400.00, 55,  NULL, TRUE),   -- 9
  (7, 'Calamansi Juice — case of 24 bottles','MAS-BV001', 12, 'Case of 24x 500mL pure calamansi concentrate, no preservatives',1560.00, 70,  NULL, TRUE),   -- 10
  (7, 'Brown Paper Bags — bundle of 500',  'MAS-PK001', 11, 'Bundle of 500 medium kraft paper bags for retail use',           900.00, 200, NULL, TRUE),   -- 11

  -- Metro Cebu Trading — Wholesale (business 10, bizswitch_demo's wholesaler side) — 2 products
  (10, 'Chicharon Baboy — box of 48 packs', 'MCT-CHP01', 4,  'Box of 48x 200g crispy pork chicharon, Cebu-style',             3600.00, 90,  NULL, TRUE),   -- 12
  (10, 'Dried Pusit — 5kg sack',            'MCT-FS001', 5,  '5kg sack of sun-dried squid, ready to grill',                   2200.00, 30,  NULL, TRUE);   -- 13

-- ---------------------------------------------------------------------------
-- 7. BRANCHES (2) — Cebu hub + Mandaue hub
-- ---------------------------------------------------------------------------
INSERT INTO branches (branch_name, address_id, contact_number) VALUES
  ('LINKO Cebu Central Hub', 4,  '+639180000001'),   -- 1  uses logistics address
  ('LINKO Mandaue Hub',      12, '+639180000002');   -- 2  uses ownerless address

-- ---------------------------------------------------------------------------
-- 8. COURIERS (2) — one per branch, linked to user accounts
-- ---------------------------------------------------------------------------
INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id, user_id) VALUES
  ('Cory Courier',  '+639170000004', 'Motorcycle', 1, 4),   -- 1  courier_demo, Cebu hub
  ('Carlo Courier', '+639170000009', 'Van',        2, 9);   -- 2  courier2_demo, Mandaue hub

-- ---------------------------------------------------------------------------
-- 9. ORDERS (5) — spread across statuses
--    Buyer 1 (business 1) orders from Wholesaler (business 2)
--    Buyer 2 (business 6) orders from Wholesaler 2 (business 7)
--    bizswitch_demo (business 8, buyer side) orders from Wholesaler (business 2)
--    Buyer 1 orders from Wholesaler 2 (business 7)
-- ---------------------------------------------------------------------------
INSERT INTO orders (buyer_business_id, wholesaler_business_id, tier_id, status, created_by, created_at, updated_at) VALUES
  (1, 2, 1, 'pending',   1, NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days'),   -- 1  pending
  (6, 7, 2, 'accepted',  6, NOW() - INTERVAL '4 days',  NOW() - INTERVAL '3 days'),   -- 2  accepted
  (8, 2, 1, 'shipped',   8, NOW() - INTERVAL '6 days',  NOW() - INTERVAL '4 days'),   -- 3  shipped (bizswitch as buyer)
  (1, 7, 3, 'delivered', 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '7 days'),   -- 4  delivered
  (6, 7, 2, 'returned',  6, NOW() - INTERVAL '8 days',  NOW() - INTERVAL '2 days');   -- 5  failed delivery

-- ---------------------------------------------------------------------------
-- 10. ORDER_ITEMS — varying quantities per order
-- ---------------------------------------------------------------------------
INSERT INTO order_items (order_id, product_id, quantity, unit_price_snapshot) VALUES
  -- Order 1 (pending): 1 item
  (1, 1, 3, 2800.00),                     -- 3x Pork Belly 10kg case = 8,400

  -- Order 2 (accepted): 2 items
  (2, 7,  5,  450.00),                    -- 5x Pandesal tray = 2,250
  (2, 10, 2, 1560.00),                    -- 2x Calamansi Juice case = 3,120

  -- Order 3 (shipped): 3 items
  (3, 3, 2, 2340.00),                     -- 2x Chicken crate = 4,680
  (3, 4, 1, 3300.00),                     -- 1x Bangus 10kg box = 3,300
  (3, 6, 1, 2400.00),                     -- 1x Mango 20kg crate = 2,400

  -- Order 4 (delivered): 2 items
  (4, 8,  3, 1020.00),                    -- 3x Carabao Milk crate = 3,060
  (4, 11, 1,  900.00),                    -- 1x Paper Bags bundle = 900

  -- Order 5 (returned after failed delivery): 1 item
  (5, 9, 2, 1400.00);                     -- 2x Lumpia Shanghai bulk pack = 2,800

-- ---------------------------------------------------------------------------
-- 11. INVOICES (4) — for accepted, shipped, delivered, returned orders
--     total = SUM(qty * unit_price_snapshot) + service_tier base_fee
-- ---------------------------------------------------------------------------
INSERT INTO invoices (order_id, invoice_number, total, issued_at) VALUES
  (2, 'INV-2-001', 5460.00,  NOW() - INTERVAL '3 days'),   -- accepted: 2250+3120+90(express fee)
  (3, 'INV-3-001', 10430.00, NOW() - INTERVAL '4 days'),   -- shipped:  4680+3300+2400+50(standard fee)
  (4, 'INV-4-001', 4110.00,  NOW() - INTERVAL '7 days'),   -- delivered: 3060+900+150(next-day fee)
  (5, 'INV-5-001', 2890.00,  NOW() - INTERVAL '6 days');   -- returned:  2800+90(express fee)

-- ---------------------------------------------------------------------------
-- 12. PARCELS (3) — for shipped, delivered, and returned orders
-- ---------------------------------------------------------------------------
-- Marketplace parcels carry a real ship-time weight but no route distance
-- (Sprint 8: checkout never measured it) -> total_distance_km is NULL. The
-- shipping_fee stays the frozen checkout quote (tier base fee).
INSERT INTO parcels (parcel_id, order_id, sender_id, receiver_id, tier_id,
                     origin_address_id, destination_address_id,
                     weight_kg, dimensions, total_distance_km,
                     declared_value, shipping_fee,
                     estimated_delivery_date) VALUES
  ('LKO-00000001', 3, 2, 8, 1, 2, 10, 8.50, '40x30x25 cm', NULL, 10380.00, 50.00,  NOW()::date + 3),   -- shipped order 3
  ('LKO-00000002', 4, 7, 1, 3, 8, 1,  4.20, '30x25x20 cm', NULL,  3960.00, 150.00, NOW()::date - 5),   -- delivered order 4 (clean journey)
  ('LKO-00000003', 5, 7, 6, 2, 8, 7,  5.50, '35x25x20 cm', NULL,  2800.00, 90.00,  NOW()::date - 2);   -- returned order 5 (failed journey)

-- Advance the parcel-ID sequence past the hardcoded LKO- seeds so the next
-- app-minted nextParcelId() does not collide with parcels_pkey (migration 016
-- setval runs before this seed, so it cannot see these rows).
SELECT setval('parcel_id_seq', 3, true);

-- ---------------------------------------------------------------------------
-- 13. TRACKING_LOGS — realistic progression
-- ---------------------------------------------------------------------------
INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id, scanned_at) VALUES
  -- Parcel LKO-00000001 (shipped/in-transit): 3 events
  ('LKO-00000001', 'Order Created',  'Auto-generated from marketplace order',   1,    NULL, NOW() - INTERVAL '4 days'),
  ('LKO-00000001', 'Picked Up',      'Picked up from Cebu Fresh warehouse',     1,    1,   NOW() - INTERVAL '3 days'),
  ('LKO-00000001', 'In Transit',     'En route to Metro Cebu Trading — Retail', 1,    1,   NOW() - INTERVAL '2 days'),

  -- Parcel LKO-00000002 (delivered): full chain, 5 events
  ('LKO-00000002', 'Order Created',     'Auto-generated from marketplace order', 2,    NULL, NOW() - INTERVAL '9 days'),
  ('LKO-00000002', 'Picked Up',         'Picked up from Mandaue Agri warehouse',2,    2,   NOW() - INTERVAL '8 days'),
  ('LKO-00000002', 'In Transit',        'Line-haul Mandaue → Cebu hub',          2,    2,   NOW() - INTERVAL '8 days'),
  ('LKO-00000002', 'Out for Delivery',  'Last mile to Sunrise Retail',            1,    1,   NOW() - INTERVAL '7 days'),
  ('LKO-00000002', 'Delivered',         'Received by staff at Lahug office',      1,    1,   NOW() - INTERVAL '7 days'),

  -- Parcel LKO-00000003 (failed delivery): full chain ending in Returned
  ('LKO-00000003', 'Order Created',     'Auto-generated from marketplace order', 2,    NULL, NOW() - INTERVAL '6 days'),
  ('LKO-00000003', 'Picked Up',         'Picked up from Mandaue Agri warehouse', 2,    2,   NOW() - INTERVAL '5 days'),
  ('LKO-00000003', 'In Transit',        'Line-haul to Davao destination',         2,    2,   NOW() - INTERVAL '4 days'),
  ('LKO-00000003', 'Out for Delivery',  'Last-mile delivery attempt',             2,    2,   NOW() - INTERVAL '2 days'),
  ('LKO-00000003', 'Returned',          'Receiver refused delivery',              2,    2,   NOW() - INTERVAL '2 days');

-- ---------------------------------------------------------------------------
-- 14. PAYMENTS — method-honest, matching live behavior (Sprint 8):
--     Online/Prepaid settle at booking (Paid + paid_at); COD stays Pending
--     until the terminal scan, then Paid on Delivered / Failed on Returned.
--     Clean journey (LKO-2) is a COD parcel collected on delivery.
-- ---------------------------------------------------------------------------
INSERT INTO payments (parcel_id, method, payment_status, amount, paid_at) VALUES
  ('LKO-00000001', 'Online', 'Paid',   NULL, NOW() - INTERVAL '4 days'),   -- marketplace ship: online, settled
  ('LKO-00000002', 'COD',    'Paid',   NULL, NOW() - INTERVAL '7 days'),   -- clean journey: COD collected on Delivered
  ('LKO-00000003', 'COD',    'Failed', NULL, NULL);                        -- failed journey: COD never collected

-- ---------------------------------------------------------------------------
-- 15. NOTIFICATIONS — none (system-generated)
-- ---------------------------------------------------------------------------
-- Intentionally empty. Notifications come from real user actions.

COMMIT;
