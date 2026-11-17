-- 031_remove_placeholder_addresses.sql - drop the 'Not provided' placeholder
-- address that business creation used to insert. A business with no real
-- address now has an empty address book and a NULL logistics pin.
--
-- businesses.logistics_address_id is ON DELETE SET NULL, so pins that pointed
-- at a placeholder clear themselves. Rows still referenced by a parcel,
-- warehouse, branch, or planned-route snapshot are left alone (the first three
-- are ON DELETE RESTRICT; the snapshot keeps its source link).
DELETE FROM addresses a
 WHERE a.business_id IS NOT NULL
   AND a.label = 'Primary'
   AND a.province = 'Not provided'
   AND a.city_municipality = 'Not provided'
   AND a.barangay = 'Not provided'
   AND a.street_address = 'Not provided'
   AND a.postal_code = '0000'
   AND a.latitude IS NULL
   AND a.longitude IS NULL
   AND NOT EXISTS (SELECT 1 FROM parcels p
                    WHERE p.origin_address_id = a.address_id
                       OR p.destination_address_id = a.address_id)
   AND NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.address_id = a.address_id)
   AND NOT EXISTS (SELECT 1 FROM branches b WHERE b.address_id = a.address_id)
   AND NOT EXISTS (SELECT 1 FROM parcel_route_stops s WHERE s.source_address_id = a.address_id);
