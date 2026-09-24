-- 025_saved_addresses.sql — multiple saved addresses per business.
-- businesses.logistics_address_id stays the single canonical pin used by
-- order placement and parcel routing. The address book marks exactly one
-- owned row as the default, and that row is the pin. Coordinate checks from
-- 024 are unchanged. Ownerless branch addresses (business_id NULL) are not
-- part of the book.

ALTER TABLE addresses
    ADD COLUMN label VARCHAR(80),
    ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- The current pin is the default, when it is an address this business owns.
UPDATE addresses AS a
   SET is_default = TRUE
  FROM businesses AS b
 WHERE b.logistics_address_id = a.address_id
   AND a.business_id = b.business_id;

UPDATE addresses
   SET label = CASE
         WHEN is_default THEN 'Primary'
         ELSE COALESCE(NULLIF(barangay, ''), 'Address')
       END
 WHERE business_id IS NOT NULL
   AND label IS NULL;

-- At most one default per business. Many non-defaults are allowed, and
-- ownerless rows are excluded so branch addresses never collide.
CREATE UNIQUE INDEX addresses_one_default_per_business
    ON addresses (business_id)
    WHERE is_default AND business_id IS NOT NULL;
