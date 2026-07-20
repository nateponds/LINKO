-- Logistics subsystem: the 8-table shipping/tracking model.
-- Source of truth: docs/linko_database_specification.md (finalized course schema).
-- CUSTOMERS is the single actor table; buyer/wholesaler is NOT a column --
-- it is read from parcels.sender_id (selling) / receiver_id (buying).
-- Tables are declared in FK-dependency order so each REFERENCES target
-- already exists when it is used.

-- Delivery speed/pricing tiers (Standard, Express, Next-Day).
CREATE TABLE service_tiers (
    tier_id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    base_rate_per_kg DECIMAL(10,2) NOT NULL,
    estimated_days INT NOT NULL
);


-- Physical hubs/warehouses where parcels are processed.
CREATE TABLE branches (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL UNIQUE,
    address_id INT NOT NULL REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    contact_number VARCHAR(20)
);

-- Riders/drivers who scan and move parcels. Home base is nullable.
CREATE TABLE couriers (
    courier_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(30),
    assigned_branch_id INT REFERENCES branches(branch_id) ON UPDATE CASCADE ON DELETE SET NULL
);

-- Master record per package. Status and lifecycle timing live in
-- tracking_logs, not here. total_cost is set by a BEFORE INSERT trigger.
CREATE TABLE parcels (
    parcel_id VARCHAR(20) PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    receiver_id INT NOT NULL REFERENCES businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    tier_id INT NOT NULL REFERENCES service_tiers(tier_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    origin_address_id INT NOT NULL REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    destination_address_id INT NOT NULL REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    weight_kg DECIMAL(6,2) NOT NULL CHECK (weight_kg > 0),
    dimensions VARCHAR(50),
    total_cost DECIMAL(10,2),
    total_distance_km DECIMAL(8,2),
    estimated_delivery_date DATE
);

-- Settlement of the shipping fee only (1:1 with parcel). payment_status is
-- the dispatch gate.
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(20) NOT NULL UNIQUE REFERENCES parcels(parcel_id) ON UPDATE CASCADE ON DELETE CASCADE,
    method VARCHAR(20) NOT NULL
        CHECK (method IN ('COD', 'Prepaid', 'Online')),
    payment_status VARCHAR(20) NOT NULL
        CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Refunded')),
    amount DECIMAL(10,2) NOT NULL,
    paid_at TIMESTAMP
);

-- Append-only scan history. Current status = latest row by scanned_at.
-- branch_id / courier_id nullable for line-haul and automated scans.
CREATE TABLE tracking_logs (
    log_id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(20) NOT NULL REFERENCES parcels(parcel_id) ON UPDATE CASCADE ON DELETE CASCADE,
    branch_id INT REFERENCES branches(branch_id) ON UPDATE CASCADE ON DELETE SET NULL,
    courier_id INT REFERENCES couriers(courier_id) ON UPDATE CASCADE ON DELETE SET NULL,
    status_update VARCHAR(50) NOT NULL
        CHECK (status_update IN ('Order Created', 'Picked Up', 'In Transit',
                                 'Out for Delivery', 'Delivered', 'Returned', 'Cancelled')),
    remarks TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- total_cost is derived (weight_kg x tier rate) but stored, so historical
-- pricing survives future service_tiers rate changes. Populate on insert;
-- only compute when the caller did not supply a value, so backfills and
-- manual overrides still win.
CREATE OR REPLACE FUNCTION fn_set_parcel_total_cost()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_cost IS NULL THEN
        SELECT NEW.weight_kg * st.base_rate_per_kg
          INTO NEW.total_cost
          FROM service_tiers st
         WHERE st.tier_id = NEW.tier_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_parcel_total_cost
BEFORE INSERT ON parcels
FOR EACH ROW
EXECUTE FUNCTION fn_set_parcel_total_cost();

-- Latest-status-by-scanned_at is the hot read path (current parcel status);
-- one-payment-per-parcel and sender/receiver lookups are the other joins.
CREATE INDEX idx_tracking_parcel_time ON tracking_logs(parcel_id, scanned_at DESC);
CREATE INDEX idx_parcels_sender ON parcels(sender_id);
CREATE INDEX idx_parcels_receiver ON parcels(receiver_id);
