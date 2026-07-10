-- Branch-scoped courier dispatch backfill.
--
-- Existing parcels keep their current status model: assignment is still
-- derived from the latest tracking_logs row. This stamps historical NULL
-- branch logs from origin city or courier home branch so the branch-scoped
-- pickup pool has data to work with after deploy.

UPDATE tracking_logs tl
   SET branch_id = m.branch_id
  FROM parcels p
  JOIN addresses o ON o.address_id = p.origin_address_id
  JOIN LATERAL (
        SELECT b.branch_id
          FROM branches b
          JOIN addresses ba ON ba.address_id = b.address_id
         WHERE LOWER(ba.city_municipality) = LOWER(o.city_municipality)
         LIMIT 1
       ) m ON TRUE
 WHERE tl.parcel_id = p.parcel_id
   AND tl.branch_id IS NULL
   AND tl.courier_id IS NULL;

UPDATE tracking_logs tl
   SET branch_id = c.assigned_branch_id
  FROM couriers c
 WHERE tl.courier_id = c.courier_id
   AND tl.branch_id IS NULL
   AND c.assigned_branch_id IS NOT NULL;
