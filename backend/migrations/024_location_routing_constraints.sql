-- 024_location_routing_constraints.sql — the location-routing delta that was
-- once folded into an edited 023. Migration 023 shipped to staging (and to
-- developers' local databases) with only the bare latitude/longitude columns
-- and branches.is_available. The migration runner keys off filename, so an
-- already-applied 023 can never gain new statements — the coordinate
-- constraints, the businesses.logistics_address_id pointer, and the
-- parcel_route_stops snapshot table live here in a new sequential file instead.
-- A fresh database applies 023 then 024 and lands on the same final schema.

-- Repair any coordinate pair 023 let through before the constraints below can
-- apply. Old demo/mock rows may hold a lone coordinate, an out-of-range value,
-- or exact (0,0) "Null Island". Unpinning them (both -> NULL) is safe: an
-- unpinned business simply re-pins through Settings.
UPDATE addresses
   SET latitude = NULL, longitude = NULL
 WHERE (latitude IS NULL) <> (longitude IS NULL)
    OR latitude NOT BETWEEN -90 AND 90
    OR longitude NOT BETWEEN -180 AND 180
    OR (latitude = 0 AND longitude = 0);

-- Coordinates on addresses (WGS84 decimal degrees) for Mapbox pinning and
-- Haversine routing. Paired (both NULL = unpinned), in range, and never
-- exactly (0,0) — the Mapbox default-center misfire.
ALTER TABLE addresses
    ADD CONSTRAINT addresses_coords_paired
        CHECK ((latitude IS NULL) = (longitude IS NULL)),
    ADD CONSTRAINT addresses_latitude_range
        CHECK (latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT addresses_longitude_range
        CHECK (longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT addresses_no_null_island
        CHECK (latitude <> 0 OR longitude <> 0);

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
