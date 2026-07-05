-- Development seed data for the logistics subsystem (migrations 002 + 003).
-- Also seeds Milestone 1 local-dev auth/RBAC demo data after 004.
-- NOT a migration: schema migrations are replayed by the runner, seed data
-- is not. Run manually in PGAdmin / psql against a dev database AFTER
-- migrations have been applied (002_logistics_schema + 003_linko_schema + 004_auth_rbac).
--
-- Idempotent: TRUNCATE-and-reload, so re-running gives a clean fixed set.
-- RESTART IDENTITY resets SERIAL counters; CASCADE clears dependent rows.
--
-- Buyer / wholesaler is behavior, not a stored type. It is read from the FK
-- slot on parcels: sender_id = selling side, receiver_id = buying side.
-- The 10 customers below are arranged so that:
--   sellers-only  (ids 1,2)      appear ONLY as sender_id
--   both          (ids 3,4)      appear as BOTH sender_id and receiver_id
--   buyers-only   (ids 5..10)    appear ONLY as receiver_id
-- customer_type is orthogonal account classification, chosen for realism.

-- Local dev auth note:
--   buyer@linko.test / Password123!
--   wholesaler@linko.test / Password123!
--   logistics@linko.test / Password123!
--   courier@linko.test / Password123!
--   admin@linko.test / Password123!

-- ---------------------------------------------------------------------------
-- AUTH / RBAC DEMO DATA
-- ---------------------------------------------------------------------------
-- Shared Node crypto.scrypt-compatible PHC string for the local-dev password.
-- Password123! => $scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==

INSERT INTO businesses (business_name, business_type, contact_number, address_line, city, is_verified)
SELECT 'Sunrise Retail Cooperative', 'buyer', '+639171200001', '14 Osmena Blvd', 'Cebu City', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM businesses WHERE business_name = 'Sunrise Retail Cooperative'
);

INSERT INTO businesses (business_name, business_type, contact_number, address_line, city, is_verified)
SELECT 'Harbor Bulk Trading', 'wholesaler', '+639171200002', '88 Portside Ave', 'Mandaue', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM businesses WHERE business_name = 'Harbor Bulk Trading'
);

INSERT INTO businesses (business_name, business_type, contact_number, address_line, city, is_verified)
SELECT 'LINKO Dispatch Services', 'buyer', '+639171200003', '5 Logistics Park', 'Cebu City', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM businesses WHERE business_name = 'LINKO Dispatch Services'
);

UPDATE users
   SET full_name = 'Bianca Buyer',
       password_hash = '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       role = 'staff',
       global_role = NULL
 WHERE email = 'buyer@linko.test';

INSERT INTO users (username, email, full_name, password_hash, role, global_role)
SELECT 'buyer_demo', 'buyer@linko.test', 'Bianca Buyer',
       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       'staff', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'buyer@linko.test'
);

UPDATE users
   SET full_name = 'Waldo Wholesaler',
       password_hash = '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       role = 'wholesaler',
       global_role = NULL
 WHERE email = 'wholesaler@linko.test';

INSERT INTO users (username, email, full_name, password_hash, role, global_role)
SELECT 'wholesaler_demo', 'wholesaler@linko.test', 'Waldo Wholesaler',
       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       'wholesaler', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'wholesaler@linko.test'
);

UPDATE users
   SET full_name = 'Lia Logistics',
       password_hash = '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       role = 'staff',
       global_role = NULL
 WHERE email = 'logistics@linko.test';

INSERT INTO users (username, email, full_name, password_hash, role, global_role)
SELECT 'logistics_demo', 'logistics@linko.test', 'Lia Logistics',
       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       'staff', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'logistics@linko.test'
);

UPDATE users
   SET full_name = 'Cory Courier',
       password_hash = '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       role = 'staff',
       global_role = NULL
 WHERE email = 'courier@linko.test';

INSERT INTO users (username, email, full_name, password_hash, role, global_role)
SELECT 'courier_demo', 'courier@linko.test', 'Cory Courier',
       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       'staff', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'courier@linko.test'
);

UPDATE users
   SET full_name = 'Pia Platform Admin',
       password_hash = '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       role = 'admin',
       global_role = 'platform_admin'
 WHERE email = 'admin@linko.test';

INSERT INTO users (username, email, full_name, password_hash, role, global_role)
SELECT 'admin_demo', 'admin@linko.test', 'Pia Platform Admin',
       '$scrypt$ln=14,r=8,p=1$JGwDhxHAsroYiq60JGW01Q==$PWx0A9eBiSvl3qFgecOCO9PbVAzlauXW17IsyqMEckDXs5GWRnDs5IMgOH+1oGeK2ONRwmTPZxzmfguq5uAorw==',
       'admin', 'platform_admin'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@linko.test'
);

INSERT INTO business_memberships (user_id, business_id, role)
SELECT u.user_id, b.business_id, 'buyer'
  FROM users u
  JOIN businesses b ON b.business_name = 'Sunrise Retail Cooperative'
 WHERE u.email = 'buyer@linko.test'
ON CONFLICT (user_id, business_id, role) DO NOTHING;

INSERT INTO business_memberships (user_id, business_id, role)
SELECT u.user_id, b.business_id, 'wholesaler'
  FROM users u
  JOIN businesses b ON b.business_name = 'Harbor Bulk Trading'
 WHERE u.email = 'wholesaler@linko.test'
ON CONFLICT (user_id, business_id, role) DO NOTHING;

INSERT INTO business_memberships (user_id, business_id, role)
SELECT u.user_id, b.business_id, 'logistics_coordinator'
  FROM users u
  JOIN businesses b ON b.business_name = 'LINKO Dispatch Services'
 WHERE u.email = 'logistics@linko.test'
ON CONFLICT (user_id, business_id, role) DO NOTHING;

INSERT INTO business_memberships (user_id, business_id, role)
SELECT u.user_id, b.business_id, 'courier'
  FROM users u
  JOIN businesses b ON b.business_name = 'LINKO Dispatch Services'
 WHERE u.email = 'courier@linko.test'
ON CONFLICT (user_id, business_id, role) DO NOTHING;

TRUNCATE tracking_logs, payments, commissions, parcels, couriers, branches,
         addresses, customers, service_tiers, commission_brackets
    RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- SERVICE TIERS
-- ---------------------------------------------------------------------------
INSERT INTO service_tiers (tier_name, base_fee, base_rate_per_kg, rate_per_km, estimated_days) VALUES
    ('Standard', 50.00,  45.00, 2.00, 5),   -- tier_id 1
    ('Express',  90.00,  80.00, 3.50, 2),   -- tier_id 2
    ('Next-Day', 150.00, 130.00, 5.00, 1);  -- tier_id 3

-- ---------------------------------------------------------------------------
-- COMMISSION BRACKETS. Must exist BEFORE parcels: the AFTER INSERT trigger
-- on parcels reads them to create each parcel's commission row.
-- Full coverage 0 -> no cap so every parcel gets a commission.
-- ---------------------------------------------------------------------------
INSERT INTO commission_brackets (min_weight_kg, max_weight_kg, fee) VALUES
    (0,  5,    20.00),   -- bracket_id 1: light
    (5,  20,   50.00),   -- bracket_id 2: medium
    (20, NULL, 100.00);  -- bracket_id 3: heavy, no cap

-- ---------------------------------------------------------------------------
-- CUSTOMERS (10). Comment tags the intended parcel-role, not a stored column.
-- ---------------------------------------------------------------------------
INSERT INTO customers (full_name, phone_number, email, customer_type) VALUES
    ('Cebu Farms Trading',        '+639171112201', 'sales@cebufarms.ph',       'msme'),        -- 1  seller-only
    ('Visayas Wholesale Corp',    '+639171112202', 'orders@vwc.com.ph',        'corporation'), -- 2  seller-only
    ('Mandaue Sari-Sari Supply',  '+639171112203', 'msss@shop.ph',             'msme'),        -- 3  both
    ('Talisay General Merch',     '+639171112204', 'tgm@merch.ph',             'msme'),        -- 4  both
    ('Juan dela Cruz',            '+639171112205', 'juan.delacruz@gmail.com',  'individual'),  -- 5  buyer-only
    ('Maria Santos',              '+639171112206', 'maria.santos@gmail.com',   'individual'),  -- 6  buyer-only
    ('Lapu-Lapu Hardware',        '+639171112207', 'llh@hardware.ph',          'msme'),        -- 7  buyer-only
    ('Davao Retail Group',        '+639171112208', 'buying@davaoretail.ph',    'corporation'), -- 8  buyer-only
    ('Pedro Reyes',               '+639171112209', 'pedro.reyes@yahoo.com',    'individual'),  -- 9  buyer-only
    ('Ana Lim Enterprises',       '+639171112210', 'ana@animports.ph',         'other');       -- 10 buyer-only

-- ---------------------------------------------------------------------------
-- ADDRESSES. First 10 owned by matching customer_id; last 3 are ownerless
-- branch addresses (customer_id NULL). Cebu-centric + a few interisland.
-- ---------------------------------------------------------------------------
INSERT INTO addresses (customer_id, province, city_municipality, barangay, street_address, postal_code) VALUES
    (1,    'Cebu',        'Cebu City',   'Mabolo',      '12 Warehouse Rd, North Reclamation',   '6000'),  -- 1
    (2,    'Cebu',        'Mandaue',     'Tipolo',      'Blk 4 Lot 9, Ouano Ave',               '6014'),  -- 2
    (3,    'Cebu',        'Mandaue',     'Guizo',       '88 Sari Street',                        '6014'),  -- 3
    (4,    'Cebu',        'Talisay',     'Tabunok',     '5 Market Row, Tabunok Public Market',   '6045'),  -- 4
    (5,    'Cebu',        'Cebu City',   'Guadalupe',   '23 V. Rama Ave',                        '6000'),  -- 5
    (6,    'Cebu',        'Cebu City',   'Lahug',       'Unit 7, Salinas Drive',                 '6000'),  -- 6
    (7,    'Cebu',        'Lapu-Lapu',   'Pajo',        '3 Quirino Hwy',                         '6015'),  -- 7
    (8,    'Davao del Sur','Davao City', 'Poblacion',   '101 San Pedro St',                      '8000'),  -- 8
    (9,    'Cebu',        'Talisay',     'Lawaan',      '14 Coastal Rd',                         '6045'),  -- 9
    (10,   'Metro Manila','Quezon City', 'Cubao',       '55 Aurora Blvd',                        '1109'),  -- 10
    (NULL, 'Cebu',        'Cebu City',   'North Reclamation', 'LINKO Cebu Hub, Serging Osmena Blvd', '6000'), -- 11 branch
    (NULL, 'Cebu',        'Mandaue',     'Subangdaku',  'LINKO Mandaue Hub, AS Fortuna St',      '6014'),  -- 12 branch
    (NULL, 'Metro Manila','Manila',      'Port Area',   'LINKO Manila Hub, Bonifacio Drive',     '1018');  -- 13 branch

-- ---------------------------------------------------------------------------
-- BRANCHES (3 hubs) -> point at the ownerless addresses 11,12,13.
-- ---------------------------------------------------------------------------
INSERT INTO branches (branch_name, address_id, contact_number) VALUES
    ('Cebu Hub',    11, '+639321000011'),  -- 1
    ('Mandaue Hub', 12, '+639321000012'),  -- 2
    ('Manila Hub',  13, '+639321000013');  -- 3

-- ---------------------------------------------------------------------------
-- COURIERS (6). Home base varies; one unassigned (NULL) line-haul driver.
-- ---------------------------------------------------------------------------
INSERT INTO couriers (full_name, phone_number, vehicle_type, assigned_branch_id) VALUES
    ('Rico Bautista',   '+639201000001', 'motorcycle', 1),     -- 1  Cebu
    ('Ella Ferrer',     '+639201000002', 'motorcycle', 1),     -- 2  Cebu
    ('Marlon Cruz',     '+639201000003', 'van',        2),     -- 3  Mandaue
    ('Grace Uy',        '+639201000004', 'motorcycle', 2),     -- 4  Mandaue
    ('Ben Tan',         '+639201000005', 'truck',      3),     -- 5  Manila
    ('Interisland Line-Haul', '+639201000006', 'truck', NULL); -- 6  no base (line-haul)

-- ---------------------------------------------------------------------------
-- PARCELS (50). shipping_fee intentionally OMITTED -> the BEFORE INSERT
-- trigger fills it from tier base fee + weight_kg x tier rate + distance_km
-- x tier per-km rate. The buyer's total (declared_value + shipping_fee) is
-- NOT stored here -- it lands on payments.amount, set by its own trigger.
-- estimated_delivery_date set explicitly
-- to model the "frozen at ship time" promise (creation date + tier SLA).
--
-- sender_id drawn only from {1,2,3,4} (the sellers + both), receiver_id only
-- from {3,4,5,6,7,8,9,10} (buyers + both), and a row never has sender=receiver.
-- origin/destination addresses use the sender's / receiver's own address id.
-- ---------------------------------------------------------------------------
INSERT INTO parcels
    (parcel_id, sender_id, receiver_id, tier_id, origin_address_id, destination_address_id,
     weight_kg, dimensions, total_distance_km, estimated_delivery_date) VALUES
    ('LNK-10000001', 1, 5, 1, 1, 5,  3.50, '30x30x20 cm',  6.20,  DATE '2026-06-01' + 5),
    ('LNK-10000002', 1, 6, 2, 1, 6,  1.20, '20x15x10 cm',  7.80,  DATE '2026-06-01' + 2),
    ('LNK-10000003', 2, 7, 1, 2, 7,  12.00,'50x40x40 cm',  9.10,  DATE '2026-06-02' + 5),
    ('LNK-10000004', 2, 8, 3, 2, 8,  0.80, '15x10x8 cm',   587.00,DATE '2026-06-02' + 1),
    ('LNK-10000005', 3, 5, 1, 3, 5,  4.25, '35x25x20 cm',  8.40,  DATE '2026-06-03' + 5),
    ('LNK-10000006', 3, 9, 2, 3, 9,  2.00, '25x20x15 cm',  5.60,  DATE '2026-06-03' + 2),
    ('LNK-10000007', 4, 6, 1, 4, 6,  6.75, '40x30x30 cm',  11.20, DATE '2026-06-04' + 5),
    ('LNK-10000008', 4, 10,3, 4, 10, 1.50, '20x20x15 cm',  585.30,DATE '2026-06-04' + 1),
    ('LNK-10000009', 1, 7, 2, 1, 7,  8.90, '45x35x30 cm',  10.50, DATE '2026-06-05' + 2),
    ('LNK-10000010', 2, 3, 1, 2, 3,  15.30,'60x45x45 cm',  7.30,  DATE '2026-06-05' + 5),
    ('LNK-10000011', 3, 6, 1, 3, 6,  3.10, '30x20x20 cm',  6.90,  DATE '2026-06-06' + 5),
    ('LNK-10000012', 4, 8, 2, 4, 8,  5.40, '35x30x25 cm',  590.10,DATE '2026-06-06' + 2),
    ('LNK-10000013', 1, 9, 1, 1, 9,  2.70, '25x20x18 cm',  9.80,  DATE '2026-06-07' + 5),
    ('LNK-10000014', 2, 10,3, 2, 10, 0.95, '18x12x10 cm',  588.40,DATE '2026-06-07' + 1),
    ('LNK-10000015', 3, 7, 2, 3, 7,  7.20, '40x35x30 cm',  6.10,  DATE '2026-06-08' + 2),
    ('LNK-10000016', 4, 5, 1, 4, 5,  4.80, '35x25x25 cm',  8.70,  DATE '2026-06-08' + 5),
    ('LNK-10000017', 1, 4, 1, 1, 4,  11.60,'55x40x40 cm',  7.80,  DATE '2026-06-09' + 5),
    ('LNK-10000018', 2, 9, 2, 2, 9,  3.30, '30x22x20 cm',  9.40,  DATE '2026-06-09' + 2),
    ('LNK-10000019', 3, 8, 3, 3, 8,  1.10, '18x14x10 cm',  586.70,DATE '2026-06-10' + 1),
    ('LNK-10000020', 4, 10,1, 4, 10, 6.00, '40x30x28 cm',  585.90,DATE '2026-06-10' + 5),
    ('LNK-10000021', 1, 5, 2, 1, 5,  2.40, '25x18x15 cm',  6.20,  DATE '2026-06-11' + 2),
    ('LNK-10000022', 2, 7, 1, 2, 7,  18.75,'65x50x45 cm',  9.10,  DATE '2026-06-11' + 5),
    ('LNK-10000023', 3, 6, 1, 3, 6,  3.90, '32x24x20 cm',  6.90,  DATE '2026-06-12' + 5),
    ('LNK-10000024', 4, 9, 2, 4, 9,  5.10, '36x28x24 cm',  4.30,  DATE '2026-06-12' + 2),
    ('LNK-10000025', 1, 8, 3, 1, 8,  0.70, '14x10x8 cm',   587.20,DATE '2026-06-13' + 1),
    ('LNK-10000026', 2, 4, 1, 2, 4,  9.40, '48x36x32 cm',  7.30,  DATE '2026-06-13' + 5),
    ('LNK-10000027', 3, 10,2, 3, 10, 4.60, '34x26x22 cm',  588.00,DATE '2026-06-14' + 2),
    ('LNK-10000028', 4, 6, 1, 4, 6,  7.80, '42x32x30 cm',  9.90,  DATE '2026-06-14' + 5),
    ('LNK-10000029', 1, 7, 1, 1, 7,  13.20,'58x42x40 cm',  8.60,  DATE '2026-06-15' + 5),
    ('LNK-10000030', 2, 9, 2, 2, 9,  2.85, '28x20x18 cm',  9.40,  DATE '2026-06-15' + 2),
    ('LNK-10000031', 3, 5, 1, 3, 5,  5.50, '38x28x24 cm',  8.40,  DATE '2026-06-16' + 5),
    ('LNK-10000032', 4, 8, 3, 4, 8,  1.30, '20x16x12 cm',  585.50,DATE '2026-06-16' + 1),
    ('LNK-10000033', 1, 6, 2, 1, 6,  6.20, '40x30x26 cm',  7.80,  DATE '2026-06-17' + 2),
    ('LNK-10000034', 2, 10,1, 2, 10, 10.10,'52x40x36 cm',  588.40,DATE '2026-06-17' + 5),
    ('LNK-10000035', 3, 7, 1, 3, 7,  4.00, '32x24x20 cm',  6.10,  DATE '2026-06-18' + 5),
    ('LNK-10000036', 4, 5, 2, 4, 5,  3.75, '30x22x18 cm',  8.70,  DATE '2026-06-18' + 2),
    ('LNK-10000037', 1, 3, 1, 1, 3,  8.30, '46x34x30 cm',  9.80,  DATE '2026-06-19' + 5),
    ('LNK-10000038', 2, 6, 3, 2, 6,  0.60, '12x10x6 cm',   7.80,  DATE '2026-06-19' + 1),
    ('LNK-10000039', 3, 8, 2, 3, 8,  5.90, '38x30x26 cm',  586.70,DATE '2026-06-20' + 2),
    ('LNK-10000040', 4, 10,1, 4, 10, 12.40,'56x42x38 cm',  585.90,DATE '2026-06-20' + 5),
    ('LNK-10000041', 1, 5, 1, 1, 5,  2.10, '24x18x14 cm',  6.20,  DATE '2026-06-21' + 5),
    ('LNK-10000042', 2, 7, 2, 2, 7,  7.60, '42x32x28 cm',  9.10,  DATE '2026-06-21' + 2),
    ('LNK-10000043', 3, 6, 1, 3, 6,  4.40, '34x26x22 cm',  6.90,  DATE '2026-06-22' + 5),
    ('LNK-10000044', 4, 9, 1, 4, 9,  9.20, '48x36x32 cm',  4.30,  DATE '2026-06-22' + 5),
    ('LNK-10000045', 1, 8, 3, 1, 8,  1.05, '16x12x10 cm',  587.20,DATE '2026-06-23' + 1),
    ('LNK-10000046', 2, 5, 2, 2, 5,  6.70, '40x30x28 cm',  7.30,  DATE '2026-06-23' + 2),
    ('LNK-10000047', 3, 10,1, 3, 10, 3.30, '30x22x20 cm',  588.00,DATE '2026-06-24' + 5),
    ('LNK-10000048', 4, 6, 1, 4, 6,  14.80,'60x46x42 cm',  9.90,  DATE '2026-06-24' + 5),
    ('LNK-10000049', 1, 7, 2, 1, 7,  5.25, '36x28x24 cm',  8.60,  DATE '2026-06-25' + 2),
    ('LNK-10000050', 2, 9, 1, 2, 9,  8.00, '44x34x30 cm',  9.40,  DATE '2026-06-25' + 5);

-- Goods value (what the buyer pays the wholesaler; remittance = this minus
-- LINKO's commission). Deterministic formula so values vary plausibly with
-- parcel size without 50 hand-picked numbers.
UPDATE parcels SET declared_value = round(weight_kg * 380 + 150, 2);

-- ---------------------------------------------------------------------------
-- PAYMENTS (1:1, all 50). amount intentionally OMITTED -> the BEFORE INSERT
-- trigger freezes the buyer's total (declared_value + shipping_fee) from the
-- parcel, which is why the declared_value UPDATE above must run first.
-- Status mix drives the dispatch gate below:
--   'Paid'     -> full lifecycle allowed
--   'COD' + 'Pending' -> allowed to dispatch (cash collected on delivery)
--   'Prepaid'/'Online' + 'Pending' or 'Failed' -> parcel stuck at Order Created
--   'Refunded' -> parcel was Returned/Cancelled
-- Deterministic rule below keeps payments consistent with the log generator:
--   parcel n where n % 10 == 0  -> Failed  (stuck)        [10,20,30,40,50]
--   n % 10 == 7                 -> Pending Prepaid (stuck)[7,17,27,37,47]
--   n % 10 == 3                 -> COD Pending (ships)    [3,13,23,33,43]
--   n % 10 == 5                 -> Refunded (returned)    [5,15,25,35,45]
--   else                        -> Paid (ships/delivers)
-- ---------------------------------------------------------------------------
INSERT INTO payments (parcel_id, method, payment_status, paid_at)
SELECT
    p.parcel_id,
    CASE
        WHEN (n % 10) = 3 THEN 'COD'
        WHEN (n % 10) IN (7, 0) THEN 'Prepaid'
        ELSE 'Online'
    END AS method,
    CASE
        WHEN (n % 10) = 0 THEN 'Failed'
        WHEN (n % 10) = 7 THEN 'Pending'
        WHEN (n % 10) = 3 THEN 'Pending'   -- COD: collected on delivery
        WHEN (n % 10) = 5 THEN 'Refunded'
        ELSE 'Paid'
    END AS payment_status,
    CASE
        WHEN (n % 10) IN (0, 7, 3) THEN NULL              -- not settled up front
        WHEN (n % 10) = 5 THEN NULL                        -- refunded, cleared
        ELSE (DATE '2026-06-01' + (n - 1)) + TIME '09:15'  -- paid at ship time
    END AS paid_at
FROM parcels p
CROSS JOIN LATERAL (SELECT CAST(RIGHT(p.parcel_id, 3) AS INT) AS n) AS x;

-- ---------------------------------------------------------------------------
-- COMMISSIONS: rows were auto-created 'Pending' by the parcels AFTER INSERT
-- trigger. Mark LINKO's cut as Collected wherever the shipping fee settled
-- ('Paid'), collected at the same moment.
-- ---------------------------------------------------------------------------
UPDATE commissions c
   SET status = 'Collected', settled_at = pay.paid_at
  FROM payments pay
 WHERE pay.parcel_id = c.parcel_id
   AND pay.payment_status = 'Paid';

-- ---------------------------------------------------------------------------
-- TRACKING LOGS. Generated procedurally so 50 parcels get realistic chains
-- without 300 hand-written rows. The chain a parcel gets depends on its
-- payment status (the dispatch gate) and its position, using the same n%10
-- buckets as payments:
--   Failed / Pending-Prepaid (n%10 in 0,7)  -> ['Order Created'] only  (gate held)
--   Refunded (n%10 = 5)                      -> Created -> Picked Up -> In Transit -> Returned
--   COD Pending (n%10 = 3)                   -> full chain to Delivered (COD ships)
--   Paid, but "in flight" (n%10 in 1,9)      -> Created -> Picked Up -> In Transit -> Out for Delivery
--   Paid, delivered (else)                   -> full chain to Delivered
-- branch_id / courier_id assigned by leg: hub scans have a branch, the
-- line-haul 'In Transit' leg has courier 6 and NULL branch (matches ERD).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    p           RECORD;
    n           INT;
    ship_ts     TIMESTAMP;
    origin_prov TEXT;
    dest_prov   TEXT;
    interisland BOOLEAN;
    hub         INT;   -- origin hub branch id (1 Cebu / 2 Mandaue / 3 Manila)
    dhub        INT;   -- destination hub branch id
    rider       INT;   -- last-mile courier
BEGIN
    FOR p IN SELECT * FROM parcels ORDER BY parcel_id LOOP
        n := CAST(RIGHT(p.parcel_id, 3) AS INT);
        -- ship time = Order Created moment; later legs offset from here.
        ship_ts := (DATE '2026-06-01' + (n - 1)) + TIME '08:00';

        SELECT province INTO origin_prov FROM addresses WHERE address_id = p.origin_address_id;
        SELECT province INTO dest_prov   FROM addresses WHERE address_id = p.destination_address_id;
        interisland := origin_prov <> dest_prov;

        -- origin hub: Mandaue-origin parcels sort through Mandaue Hub(2),
        -- everything else Cebu-origin through Cebu Hub(1).
        SELECT CASE WHEN city_municipality = 'Mandaue' THEN 2 ELSE 1 END
          INTO hub FROM addresses WHERE address_id = p.origin_address_id;
        -- destination hub: interisland lands at Manila Hub(3), else same as origin region.
        dhub := CASE WHEN interisland THEN 3 ELSE hub END;
        rider := 1 + (n % 5);  -- couriers 1..5 (last-mile, never the line-haul 6)

        -- ---- Always: Order Created (system scan at origin hub, no courier) ----
        INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
        VALUES (p.parcel_id, hub, NULL, 'Order Created', 'Shipment booked, awaiting pickup', ship_ts);

        -- ---- Gate held: Failed payment or unpaid prepaid -> stop here ----
        IF (n % 10) IN (0, 7) THEN
            CONTINUE;
        END IF;

        -- ---- Picked Up (courier at origin hub) ----
        INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
        VALUES (p.parcel_id, hub, rider, 'Picked Up', 'Collected by rider', ship_ts + INTERVAL '3 hours');

        -- ---- In Transit (line-haul: NULL branch, courier 6 if interisland) ----
        INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
        VALUES (p.parcel_id, NULL,
                CASE WHEN interisland THEN 6 ELSE rider END,
                'In Transit',
                CASE WHEN interisland THEN 'Departed on interisland line-haul' ELSE 'En route to destination hub' END,
                ship_ts + INTERVAL '8 hours');

        -- ---- Refunded parcels are Returned here, never delivered ----
        IF (n % 10) = 5 THEN
            INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
            VALUES (p.parcel_id, dhub, rider, 'Returned', 'Receiver refused; returned to sender', ship_ts + INTERVAL '2 days');
            CONTINUE;
        END IF;

        -- ---- Out for Delivery (arrived at destination hub, on the van) ----
        INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
        VALUES (p.parcel_id, dhub, rider, 'Out for Delivery', 'Loaded for final delivery',
                ship_ts + (CASE WHEN interisland THEN INTERVAL '30 hours' ELSE INTERVAL '20 hours' END));

        -- ---- Paid-but-in-flight (n%10 in 1,9): stop at Out for Delivery ----
        IF (n % 10) IN (1, 9) THEN
            CONTINUE;
        END IF;

        -- ---- Delivered (final) ----
        INSERT INTO tracking_logs (parcel_id, branch_id, courier_id, status_update, remarks, scanned_at)
        VALUES (p.parcel_id, dhub, rider, 'Delivered', 'Received by consignee',
                ship_ts + (CASE WHEN interisland THEN INTERVAL '34 hours' ELSE INTERVAL '24 hours' END));
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Sanity peek (optional): current status per parcel = latest log by scanned_at.
-- ---------------------------------------------------------------------------
-- SELECT p.parcel_id, pay.payment_status,
--        (SELECT status_update FROM tracking_logs t
--          WHERE t.parcel_id = p.parcel_id
--          ORDER BY scanned_at DESC LIMIT 1) AS current_status
--   FROM parcels p JOIN payments pay ON pay.parcel_id = p.parcel_id
--  ORDER BY p.parcel_id;
