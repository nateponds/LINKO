-- ============================================================================
-- LINKO Logistics — DEMO QUERIES for schema/implementation presentation.
-- Run after migrations (002_logistics_schema + 003_linko_schema) + dev_seed.sql.
-- Each query is labelled with the DESIGN DECISION it proves. Run them in
-- order; the header comment is your talking point for that slide.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Q1. TRIGGER PROOF — shipping_fee is derived (tier base fee + weight_kg x
--     tier rate + distance_km x tier per-km rate) but STORED, set by the
--     BEFORE INSERT trigger. This recomputes it live and shows the stored
--     value matches: proof the trigger fired, not hand-entered data.
--     declared_value rides along as the goods price; the buyer's full outlay
--     (declared_value + shipping_fee) lives on payments.amount (see Q11).
-- ----------------------------------------------------------------------------
SELECT
    p.parcel_id,
    p.weight_kg,
    p.total_distance_km,
    st.tier_name,
    st.base_fee,
    st.base_rate_per_kg,
    st.rate_per_km,
    st.base_fee + p.weight_kg * st.base_rate_per_kg
        + COALESCE(p.total_distance_km, 0) * st.rate_per_km AS expected_fee,
    p.shipping_fee                                          AS stored_fee,
    (p.shipping_fee = st.base_fee + p.weight_kg * st.base_rate_per_kg
        + COALESCE(p.total_distance_km, 0) * st.rate_per_km) AS trigger_ok,
    p.declared_value
FROM parcels p
JOIN service_tiers st ON st.tier_id = p.tier_id
ORDER BY p.parcel_id
LIMIT 10;


-- ----------------------------------------------------------------------------
-- Q2. ROLE-VIA-FK — buyer/wholesaler is NOT a column. It is read from which
--     slot a business occupies on a parcel: sender_id = selling, receiver_id =
--     buying. This classifies every business by BEHAVIOUR, not stored type,
--     and finds the two who play BOTH sides.
-- ----------------------------------------------------------------------------
SELECT
    b.business_id,
    b.business_name,
    b.business_type,
    count(*) FILTER (WHERE p.sender_id   = b.business_id) AS parcels_sent,
    count(*) FILTER (WHERE p.receiver_id = b.business_id) AS parcels_received,
    CASE
        WHEN bool_or(p.sender_id = b.business_id)
         AND bool_or(p.receiver_id = b.business_id) THEN 'both (wholesaler + buyer)'
        WHEN bool_or(p.sender_id = b.business_id)   THEN 'wholesaler (sells only)'
        WHEN bool_or(p.receiver_id = b.business_id) THEN 'buyer (buys only)'
        ELSE 'no activity'
    END AS behavioural_role
FROM businesses b
LEFT JOIN parcels p
       ON p.sender_id = b.business_id OR p.receiver_id = b.business_id
GROUP BY b.business_id, b.business_name, b.business_type
ORDER BY b.business_id;


-- ----------------------------------------------------------------------------
-- Q3. STATUS LIVES ONLY IN TRACKING_LOGS — parcels has no current_status
--     column. "Where is my parcel now" = the latest log row by scanned_at.
--     DISTINCT ON is the clean Postgres way to grab one latest row per parcel.
-- ----------------------------------------------------------------------------
SELECT DISTINCT ON (t.parcel_id)
    t.parcel_id,
    t.status_update AS current_status,
    t.scanned_at    AS as_of,
    b.branch_name   AS last_seen_at,
    co.full_name    AS last_handled_by
FROM tracking_logs t
LEFT JOIN branches b  ON b.branch_id  = t.branch_id
LEFT JOIN couriers co ON co.courier_id = t.courier_id
ORDER BY t.parcel_id, t.scanned_at DESC, t.log_id DESC;


-- ----------------------------------------------------------------------------
-- Q4. FULL PARCEL JOURNEY — the append-only event history for ONE parcel,
--     in order. Shows scanned_at carries per-event timing (Order Created =
--     creation, Delivered = delivery) with no timestamp columns on parcels.
--     Change the id to demo a delivered vs a stuck vs a returned parcel.
-- ----------------------------------------------------------------------------
SELECT
    t.scanned_at,
    t.status_update,
    b.branch_name AS at_branch,
    co.full_name  AS handled_by,
    t.remarks
FROM tracking_logs t
LEFT JOIN branches b  ON b.branch_id  = t.branch_id
LEFT JOIN couriers co ON co.courier_id = t.courier_id
WHERE t.parcel_id = 'LNK-10000001'   -- <-- swap: try ...010 (stuck), ...005 (returned)
ORDER BY t.scanned_at, t.log_id;


-- ----------------------------------------------------------------------------
-- Q5. DISPATCH GATE — "await payment before dispatch" is modelled as: a parcel
--     with an unpaid Prepaid/Online payment has NO 'Picked Up' log yet. This
--     finds every parcel held at the gate (paid up front? no. COD? no).
-- ----------------------------------------------------------------------------
SELECT
    p.parcel_id,
    pay.method,
    pay.payment_status,
    p.shipping_fee,
    NOT EXISTS (
        SELECT 1 FROM tracking_logs t
         WHERE t.parcel_id = p.parcel_id
           AND t.status_update <> 'Order Created'
    ) AS still_at_gate
FROM parcels p
JOIN payments pay ON pay.parcel_id = p.parcel_id
WHERE pay.method IN ('Prepaid', 'Online')
  AND pay.payment_status <> 'Paid'
ORDER BY p.parcel_id;


-- ----------------------------------------------------------------------------
-- Q6. ADDRESS NORMALIZATION + REUSE — one ADDRESSES table feeds businesss,
--     branches, AND both ends of a parcel. This reads a full parcel label by
--     joining the SAME table twice (origin + destination), proving the 1:N
--     structured-address design (no flat address_line duplication).
-- ----------------------------------------------------------------------------
SELECT
    p.parcel_id,
    o.city_municipality || ', ' || o.province AS origin,
    d.city_municipality || ', ' || d.province AS destination,
    p.total_distance_km,
    CASE WHEN o.province <> d.province THEN 'interisland' ELSE 'local' END AS haul
FROM parcels p
JOIN addresses o ON o.address_id = p.origin_address_id
JOIN addresses d ON d.address_id = p.destination_address_id
ORDER BY p.total_distance_km DESC
LIMIT 10;


-- ----------------------------------------------------------------------------
-- Q7. OPERATIONS ROLL-UP — parcel volume + revenue per destination hub, by
--     tier. Shows the schema answers real business questions, and that
--     estimated_days (the SLA) rides along per tier.
-- ----------------------------------------------------------------------------
SELECT
    st.tier_name,
    st.estimated_days AS sla_days,
    count(*)                        AS parcels,
    round(sum(p.shipping_fee), 2)   AS shipping_revenue,
    round(avg(p.weight_kg), 2)      AS avg_weight_kg
FROM parcels p
JOIN service_tiers st ON st.tier_id = p.tier_id
GROUP BY st.tier_name, st.estimated_days
ORDER BY shipping_revenue DESC;


-- ----------------------------------------------------------------------------
-- Q8. COURIER WORKLOAD — who scanned how many parcels, and from which home
--     base. Uses the nullable courier FK: the line-haul driver (no home base)
--     and system scans (NULL courier) both appear correctly.
-- ----------------------------------------------------------------------------
SELECT
    co.full_name,
    co.vehicle_type,
    b.branch_name AS home_base,
    count(t.log_id) AS scans_made
FROM couriers co
LEFT JOIN branches b     ON b.branch_id  = co.assigned_branch_id
LEFT JOIN tracking_logs t ON t.courier_id = co.courier_id
GROUP BY co.courier_id, co.full_name, co.vehicle_type, b.branch_name
ORDER BY scans_made DESC;
