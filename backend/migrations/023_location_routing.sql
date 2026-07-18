-- 023_location_routing.sql — location routing schema (Sprint 13).
-- Edited in place pre-launch: this migration never reached main or the
-- production database, so there is no deployed schema to stay compatible
-- with. Developers drop and re-migrate local databases once.

-- Coordinates on addresses (WGS84 decimal degrees) for Mapbox pinning and
-- Haversine routing. Paired (both NULL = unpinned), in range, and never
-- exactly (0,0) — "Null Island", the Mapbox default-center misfire.
ALTER TABLE addresses
    ADD COLUMN latitude NUMERIC(10, 7),
    ADD COLUMN longitude NUMERIC(10, 7),
    ADD CONSTRAINT addresses_coords_paired
        CHECK ((latitude IS NULL) = (longitude IS NULL)),
    ADD CONSTRAINT addresses_latitude_range
        CHECK (latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT addresses_longitude_range
        CHECK (longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT addresses_no_null_island
        CHECK (latitude <> 0 OR longitude <> 0);

-- Temporary gate on NEW automatic assignment only. Distinct from is_active
-- (permanent soft retirement, migration 015): toggling availability never
-- unassigns couriers and never blocks in-flight parcel movement — a disabled
-- branch drains through the full status path.
ALTER TABLE branches
    ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true;

-- Canonical logistics pin per business: buyer delivery location / wholesaler
-- pickup location. Registration points this at the placeholder address it
-- creates; the Settings PUT repairs or replaces it. Replaces the
-- nondeterministic LIMIT 1 wholesaler-address pick at marketplace ship time.
ALTER TABLE businesses
    ADD COLUMN logistics_address_id INT
        REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Immutable planned-route snapshot (origin -> branch -> destination), created
-- once at automatic assignment or at the first later manual assignment, never
-- recomputed. Text and coordinates are copies, not joins: parcels point at
-- mutable address rows, and re-pinning a business or branch must never
-- rewrite history. The PK makes snapshot creation idempotent under retries.
-- Display-only reference data — actual tracking diverges freely.
CREATE TABLE parcel_route_stops (
    parcel_id VARCHAR(20) NOT NULL REFERENCES parcels(parcel_id) ON UPDATE CASCADE ON DELETE CASCADE,
    stop_order SMALLINT NOT NULL CHECK (stop_order BETWEEN 1 AND 3),
    stop_type VARCHAR(20) NOT NULL CHECK (stop_type IN ('origin', 'branch', 'destination')),
    source_address_id INT REFERENCES addresses(address_id) ON UPDATE CASCADE ON DELETE SET NULL,
    branch_id INT REFERENCES branches(branch_id) ON UPDATE CASCADE,
    label VARCHAR(150) NOT NULL,
    province VARCHAR(50),
    city_municipality VARCHAR(50),
    barangay VARCHAR(50),
    street_address VARCHAR(150),
    postal_code VARCHAR(10),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    PRIMARY KEY (parcel_id, stop_order)
);
