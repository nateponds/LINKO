-- Add coordinate columns to addresses for Mapbox geocoding and Haversine routing
ALTER TABLE addresses
ADD COLUMN latitude DECIMAL(10, 7),
ADD COLUMN longitude DECIMAL(10, 7);

-- Add availability flag to branches to gracefully toggle auto-assignment (P1)
ALTER TABLE branches
ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT true;
