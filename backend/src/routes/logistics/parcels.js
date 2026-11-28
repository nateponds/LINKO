import { Router } from "express";
import { query, getPool, nextParcelId } from "../../db.js";
import { requireAnyRole, requireAuth } from "../../middleware/auth.js";
import {
  activeMemberships,
  isPlatformAdmin,
} from "../../middleware/ownership.js";
import { notifyBusiness } from "../../services/notify.js";
import {
  computeRouteDistanceKm,
  createInitialRouteSnapshot,
  resolveInitialBranchId,
  suggestLeastLoadedCourierId,
} from "../../services/parcelRouting.js";
import { restoreOrderStock } from "../orders.js";
import { buildPaginatedResponse } from "../../services/pagination.js";
import {
  asClientError,
  assignmentClause,
  canCourierSubmitTrackingStatus,
  canSubmitTrackingStatus,
  createHttpError,
  FAIL_REASONS,
  HARD_FAIL_REASONS,
  isHardFailReason,
  LATEST_PARCEL_LOG_SQL,
  LOGISTICS_OPS_ROLES,
  PARCEL_CREATE_ROLES,
  PARCEL_READ_ROLES,
  PARCEL_TRACKING_ROLES,
  parcelListBaseFilter,
  parcelScope,
  parseParcelListQuery,
  redactParcelDetailConfidentialFields,
  redactParcelListShippingFee,
  resolveActiveCourier,
  RETURN_TRIGGER_FAILS,
  TERMINAL_TRACKING_STATUS_LIST,
  truncateBuyerReturnTracking,
  VALID_TRACKING_STATUSES,
} from "./shared.js";

const router = Router();

// Coordinator decision counts. Couriers already get assignment facets on
// GET /parcels; this stays off that list so the parcel workflow is unchanged.
router.get(
  "/logistics/decisions",
  requireAuth,
  requireAnyRole(LOGISTICS_OPS_ROLES),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT COUNT(*) FILTER (
                  WHERE (latest.status_update IS NULL
                         OR latest.status_update <> ALL($1::text[]))
                    AND latest.courier_id IS NULL
                )::int AS unassigned_parcels,
                COUNT(*) FILTER (
                  WHERE latest.status_update = $2
                    AND latest.scanned_at < CURRENT_TIMESTAMP - make_interval(days => $3::int)
                )::int AS aging_pending_parcels,
                COUNT(*) FILTER (
                  WHERE (latest.status_update IS NULL
                         OR latest.status_update <> ALL($1::text[]))
                    AND latest.courier_id IS NOT NULL
                )::int AS courier_active_load
           FROM parcels p
           ${LATEST_PARCEL_LOG_SQL}`,
        [TERMINAL_TRACKING_STATUS_LIST, "Order Created", 2],
      );
      const row = rows[0];
      res.json({
        unassignedParcels: row.unassigned_parcels,
        agingPendingParcels: row.aging_pending_parcels,
        courierActiveLoad: row.courier_active_load,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Buyers pass the gate only for the single-parcel read (track-my-order);
// the list below yields nothing for a buyer-only caller and every write
// route layers its own tighter requireAnyRole without "buyer".
router.get(
  "/parcels",
  requireAuth,
  requireAnyRole(PARCEL_READ_ROLES),
  async (req, res) => {
    const filters = parseParcelListQuery(req.query);
    const scope = await parcelScope(req);

    // No list scope (e.g. buyer-only active business): empty list, never an
    // unfiltered full-table read.
    if (scope.none) {
      res.json({
        ...buildPaginatedResponse([], filters, 0),
        facets: { assignment_counts: { available: 0, active: 0, completed: 0 } },
      });
      return;
    }

    const base = parcelListBaseFilter(scope, filters);
    const terminalParam = base.params.length + 1;
    const selectedAssignment = assignmentClause(
      filters.assignment,
      terminalParam,
    );
    const filterClause = [base.clause, selectedAssignment]
      .filter(Boolean)
      .join(" AND ");

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FILTER (WHERE latest.courier_id IS NULL
                                    AND (latest.status_update IS NULL
                                         OR latest.status_update <> ALL($${terminalParam}::text[])))::int
                 AS available,
              COUNT(*) FILTER (WHERE latest.courier_id IS NOT NULL
                                    AND (latest.status_update IS NULL
                                         OR latest.status_update <> ALL($${terminalParam}::text[])))::int
                 AS active,
              COUNT(*) FILTER (WHERE latest.status_update = ANY($${terminalParam}::text[]))::int
                 AS completed,
              COUNT(*) FILTER (WHERE ${selectedAssignment ?? "TRUE"})::int AS total_items
         FROM parcels p
         JOIN businesses s ON s.business_id = p.sender_id
         JOIN businesses r ON r.business_id = p.receiver_id
         ${LATEST_PARCEL_LOG_SQL}
         ${base.clause ? `WHERE ${base.clause}` : ""}`,
      [...base.params, TERMINAL_TRACKING_STATUS_LIST],
    );

    // return_triggered subquery reads the hard-reason list as the last bind param.
    const params = [...base.params];
    if (selectedAssignment) params.push(TERMINAL_TRACKING_STATUS_LIST);
    const hardParam = params.length + 1;
    params.push(HARD_FAIL_REASONS, filters.limit, filters.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;
    const { rows } = await query(
      `
      SELECT p.parcel_id,
             json_build_object('business_id', s.business_id, 'business_name', s.business_name) AS sender,
             json_build_object('business_id', r.business_id, 'business_name', r.business_name) AS receiver,
             st.tier_name,
             p.weight_kg::float8,
             p.shipping_fee::float8,
             p.estimated_delivery_date,
             latest.status_update AS current_status,
             latest.scanned_at    AS last_scanned_at,
             latest.courier_id    AS latest_courier_id,
             (SELECT COUNT(*)::int FROM tracking_logs f
               WHERE f.parcel_id = p.parcel_id
                 AND f.status_update = 'Delivery Failed') AS failed_attempts,
             (SELECT (COUNT(*) FILTER (WHERE f.status_update = 'Delivery Failed') >= ${RETURN_TRIGGER_FAILS}
                      OR bool_or(f.status_update = 'Delivery Failed'
                                 AND TRIM(f.remarks) = ANY($${hardParam}::text[])))
                FROM tracking_logs f
               WHERE f.parcel_id = p.parcel_id) AS return_triggered
        FROM parcels p
        JOIN businesses s      ON s.business_id = p.sender_id
        JOIN businesses r      ON r.business_id = p.receiver_id
        JOIN service_tiers st ON st.tier_id = p.tier_id
        ${LATEST_PARCEL_LOG_SQL}
        ${filterClause ? `WHERE ${filterClause}` : ""}
       ORDER BY latest.scanned_at DESC NULLS LAST, p.parcel_id ASC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    const counts = countRows[0];
    redactParcelListShippingFee(rows, scope);
    res.json({
      ...buildPaginatedResponse(rows, filters, counts.total_items),
      facets: {
        assignment_counts: {
          available: counts.available,
          active: counts.active,
          completed: counts.completed,
        },
      },
    });
  },
);

router.get(
  "/parcels/:id",
  requireAuth,
  requireAnyRole(PARCEL_READ_ROLES),
  async (req, res, next) => {
    const scope = await parcelScope(req);
    const { rows } = await query(
      `
      SELECT p.parcel_id,
             p.sender_id, p.receiver_id,
             json_build_object('business_id', s.business_id, 'business_name', s.business_name,
                               'contact_number', s.contact_number) AS sender,
             json_build_object('business_id', r.business_id, 'business_name', r.business_name,
                               'contact_number', r.contact_number) AS receiver,
             json_build_object('tier_id', st.tier_id, 'tier_name', st.tier_name,
                               'estimated_days', st.estimated_days) AS tier,
             json_build_object('province', o.province, 'city_municipality', o.city_municipality,
                               'barangay', o.barangay, 'street_address', o.street_address,
                               'postal_code', o.postal_code) AS origin_address,
             json_build_object('province', d.province, 'city_municipality', d.city_municipality,
                               'barangay', d.barangay, 'street_address', d.street_address,
                               'postal_code', d.postal_code) AS destination_address,
             p.weight_kg::float8, p.dimensions, p.declared_value::float8,
             p.shipping_fee::float8, p.total_distance_km::float8,
             p.estimated_delivery_date,
             json_build_object('method', pay.method, 'payment_status', pay.payment_status,
                               'amount', pay.amount, 'paid_at', pay.paid_at) AS payment,
             latest.status_update AS current_status,
             latest.courier_id AS latest_courier_id,
             latest.branch_id AS latest_branch_id,
             (SELECT json_agg(json_build_object(
                        'status_update', tl.status_update,
                        'branch_name', b.branch_name,
                        'courier_name', c.full_name,
                        'remarks', tl.remarks,
                        'scanned_at', tl.scanned_at)
                      ORDER BY tl.scanned_at, tl.log_id)
                FROM tracking_logs tl
                LEFT JOIN branches b ON b.branch_id = tl.branch_id
                LEFT JOIN couriers c ON c.courier_id = tl.courier_id
               WHERE tl.parcel_id = p.parcel_id) AS tracking_history,
             COALESCE(
               (SELECT json_agg(json_build_object(
                          'stop_order', prs.stop_order,
                          'stop_type', prs.stop_type,
                          'branch_id', prs.branch_id,
                          'label', prs.label,
                          'latitude', prs.latitude::float8,
                          'longitude', prs.longitude::float8)
                        ORDER BY prs.stop_order)
                  FROM parcel_route_stops prs
                 WHERE prs.parcel_id = p.parcel_id),
               '[]'::json
             ) AS planned_route
        FROM parcels p
        JOIN businesses s      ON s.business_id = p.sender_id
        JOIN businesses r      ON r.business_id = p.receiver_id
        JOIN service_tiers st ON st.tier_id = p.tier_id
        JOIN addresses o      ON o.address_id = p.origin_address_id
        JOIN addresses d      ON d.address_id = p.destination_address_id
        LEFT JOIN payments pay ON pay.parcel_id = p.parcel_id
        ${LATEST_PARCEL_LOG_SQL}
       WHERE p.parcel_id = $1`,
      [req.params.id],
    );

    if (!rows.length) {
      return next(createHttpError(404, `Parcel ${req.params.id} not found`));
    }

    // Ownership: same rule as the list. A caller who cannot see this parcel gets
    // a 404 (not 403) so parcel existence is not leaked -- matches the not-found
    // response above.
    const parcel = rows[0];
    let courierHistoryVisible = false;
    if (scope.courierId !== undefined && scope.courierId !== null) {
      const history = await query(
        `SELECT EXISTS (
           SELECT 1 FROM tracking_logs h
            WHERE h.parcel_id = $1 AND h.courier_id = $2
         ) AS visible`,
        [parcel.parcel_id, scope.courierId],
      );
      courierHistoryVisible = history.rows[0].visible;
    }

    const courierPoolVisible =
      scope.courierId !== undefined &&
      parcel.latest_courier_id === null &&
      parcel.latest_branch_id !== null &&
      scope.courierBranchId !== null &&
      parcel.latest_branch_id === scope.courierBranchId;

    const visible =
      scope.all ||
      (scope.businessIds &&
        (scope.businessIds.includes(parcel.sender_id) ||
          scope.businessIds.includes(parcel.receiver_id))) ||
      (scope.receiverOnlyIds?.includes(parcel.receiver_id) ?? false) ||
      courierHistoryVisible ||
      courierPoolVisible;

    if (!visible) {
      return next(createHttpError(404, `Parcel ${req.params.id} not found`));
    }

    truncateBuyerReturnTracking(parcel, scope);
    redactParcelDetailConfidentialFields(parcel, scope);

    // Suggestion only. POST /tracking still stores an explicit courier_id and
    // leaves an omitted one unassigned. Computed after the buyer cutoff so a
    // hidden return-leg branch does not leak a courier pick.
    parcel.suggested_courier_id = await suggestLeastLoadedCourierId(
      { query },
      parcel.latest_branch_id,
      TERMINAL_TRACKING_STATUS_LIST,
    );

    res.json(parcel);
  },
);

router.post(
  "/parcels",
  requireAuth,
  requireAnyRole(PARCEL_CREATE_ROLES),
  async (req, res, next) => {
    // Sprint 13: total_distance_km is no longer read from the body - the
    // server computes the pricing distance itself (ignored if sent).
    const {
      sender_id,
      receiver_id,
      tier_id,
      origin_address_id,
      destination_address_id,
      weight_kg,
      dimensions,
      declared_value,
      payment_method,
    } = req.body ?? {};

    // The validation-middleware task belongs to Sprint 2 proper; until it
    // lands, check the minimum needed for a sane insert here.
    const required = {
      sender_id,
      receiver_id,
      tier_id,
      origin_address_id,
      destination_address_id,
      weight_kg,
      payment_method,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missing.length) {
      return next(
        createHttpError(400, `Missing required fields: ${missing.join(", ")}`),
      );
    }
    if (Number(weight_kg) <= 0 || Number.isNaN(Number(weight_kg))) {
      return next(
        createHttpError(400, "weight_kg must be a number greater than 0"),
      );
    }
    if (!["COD", "Prepaid", "Online"].includes(payment_method)) {
      return next(
        createHttpError(
          400,
          "payment_method must be one of COD, Prepaid, Online",
        ),
      );
    }

    // Sender must be derived from the caller's own business, never trusted from
    // the body. When the ACTIVE business is a wholesaler, it is the only sender
    // allowed: reject any body sender_id that does not match it. Logistics
    // coordinators (active) and platform admins operate the whole network, so
    // they may book on behalf of any sender business.
    let effectiveSenderId = sender_id;
    const activeWholesaler = isPlatformAdmin(req.auth.user)
      ? undefined
      : activeMemberships(req).find((m) => m.role === "wholesaler");
    if (activeWholesaler) {
      const ownBusinessId = activeWholesaler.business_id;
      if (Number(sender_id) !== ownBusinessId) {
        return next(createHttpError(403, "sender_id must be your own business"));
      }
      effectiveSenderId = ownBusinessId;
    }

    // One transaction: parcel + payment + first tracking log + route snapshot
    // all appear or none do. The 003 triggers fill shipping_fee and
    // payments.amount along the way.
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      // Ownership validation (Sprint 13): a caller could otherwise steer
      // branch assignment and pricing with a foreign address ID.
      const endpoints = await client.query(
        `SELECT address_id, business_id, latitude, longitude
           FROM addresses
          WHERE address_id IN ($1, $2)`,
        [origin_address_id, destination_address_id],
      );
      const byId = new Map(endpoints.rows.map((row) => [row.address_id, row]));
      const origin = byId.get(Number(origin_address_id));
      const destination = byId.get(Number(destination_address_id));
      if (!origin || origin.business_id !== Number(effectiveSenderId)) {
        throw createHttpError(
          400,
          "origin_address_id must belong to the sender business",
        );
      }
      if (!destination || destination.business_id !== Number(receiver_id)) {
        throw createHttpError(
          400,
          "destination_address_id must belong to the receiver business",
        );
      }

      // Pin gate (Sprint 13): pricing distance needs both endpoints. BLOCK,
      // not degrade - pre-launch means there is no legacy class to grandfather.
      if (
        origin.latitude === null ||
        origin.longitude === null ||
        destination.latitude === null ||
        destination.longitude === null
      ) {
        throw createHttpError(
          409,
          "Origin and destination addresses must have coordinates before booking",
        );
      }

      const parcelId = await nextParcelId(client);
      const distanceKm = await computeRouteDistanceKm(
        client,
        origin_address_id,
        destination_address_id,
      );

      const { rows } = await client.query(
        `
        INSERT INTO parcels (parcel_id, sender_id, receiver_id, tier_id,
                             origin_address_id, destination_address_id,
                             weight_kg, dimensions, declared_value,
                             total_distance_km, estimated_delivery_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), $10,
                CURRENT_DATE + (SELECT estimated_days FROM service_tiers WHERE tier_id = $4))
        RETURNING parcel_id, shipping_fee::float8, declared_value::float8, estimated_delivery_date`,
        [
          parcelId,
          effectiveSenderId,
          receiver_id,
          tier_id,
          origin_address_id,
          destination_address_id,
          weight_kg,
          dimensions ?? null,
          declared_value ?? null,
          distanceKm,
        ],
      );

      // Method-honest status: Prepaid/Online are settled at booking; COD stays
      // Pending until the terminal scan. The dispatch gate remains modeled, not
      // enforced (local-notes/course-deliverable.md).
      const paymentStatus = payment_method === "COD" ? "Pending" : "Paid";
      await client.query(
        `INSERT INTO payments (parcel_id, method, payment_status, amount, paid_at)
         VALUES ($1, $2, $3, NULL,
                 CASE WHEN $3::varchar = 'Paid' THEN CURRENT_TIMESTAMP END)`,
        [parcelId, payment_method, paymentStatus],
      );

      // Assignment miss never fails the booking: a NULL branch leaves the
      // parcel branchless (invisible to courier pools) for manual assignment.
      const originBranchId = await resolveInitialBranchId(
        client,
        origin_address_id,
      );

      await client.query(
        `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, recorded_by)
         VALUES ($1, 'Order Created', 'Booking confirmed', $2, $3)`,
        [parcelId, originBranchId, req.auth.user.user_id],
      );

      await createInitialRouteSnapshot(client, parcelId, originBranchId);

      await client.query("COMMIT");

      res.status(201).json({ ...rows[0], current_status: "Order Created" });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(error));
    } finally {
      client.release();
    }
  },
);

router.post(
  "/parcels/:id/tracking",
  requireAuth,
  requireAnyRole(PARCEL_TRACKING_ROLES),
  async (req, res, next) => {
    const parcelId = req.params.id;
    const { status_update, remarks, branch_id, courier_id } = req.body ?? {};

    if (!VALID_TRACKING_STATUSES.includes(status_update)) {
      return next(createHttpError(400, "Invalid status_update"));
    }

    // Couriers act as themselves: stamp courier_id and home branch from their
    // linked couriers row and ignore client-supplied values (no spoofing).
    // Coordinators/admins may assign explicitly.
    let effectiveCourierId = courier_id || null;
    let effectiveBranchId = branch_id || null;
    const isPrivileged =
      isPlatformAdmin(req.auth.user) ||
      activeMemberships(req).some((m) => m.role === "logistics_coordinator");
    if (!isPrivileged) {
      const courier = await resolveActiveCourier(req.auth.user.user_id);
      if (!courier) {
        return next(
          createHttpError(
            403,
            "Your account is not linked to an active courier profile",
          ),
        );
      }
      effectiveCourierId = courier.courier_id;
      effectiveBranchId = courier.assigned_branch_id ?? null;
    }

    // Transaction: the scan and its order side effect commit together.
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const lock = await client.query(
        "SELECT parcel_id FROM parcels WHERE parcel_id = $1 FOR UPDATE",
        [parcelId],
      );
      if (lock.rowCount === 0) {
        throw createHttpError(404, `Parcel ${parcelId} not found`);
      }

      // Fail count is derived, never stored on parcels - parcel state lives only
      // in tracking_logs (docs/LINKO_ERD.md design notes). It gates the courier
      // Delivery Failed edge and fires the 3rd-fail notification below.
      const failCount = await client.query(
        `SELECT COUNT(*)::int AS n
           FROM tracking_logs
          WHERE parcel_id = $1 AND status_update = 'Delivery Failed'`,
        [parcelId],
      );
      const failedAttempts = failCount.rows[0].n;

      // Return-leg signal for gating, derived from history BEFORE this insert:
      // the retry cap was already reached, OR a prior fail carried a hard reason.
      const priorHardFail = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM tracking_logs
            WHERE parcel_id = $1 AND status_update = 'Delivery Failed'
              AND TRIM(remarks) = ANY($2::text[])
         ) AS hard`,
        [parcelId, HARD_FAIL_REASONS],
      );
      const returnTriggered =
        failedAttempts >= RETURN_TRIGGER_FAILS || priorHardFail.rows[0].hard;

      // Coordinators/admins may assign branch_id/courier_id explicitly from the
      // body (unlike the courier path below, which is server-stamped) -- so
      // those client-supplied references need their own active check.
      if (isPrivileged) {
        if (effectiveBranchId !== null) {
          const activeBranch = await client.query(
            "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
            [effectiveBranchId],
          );
          if (!activeBranch.rowCount) {
            throw createHttpError(
              400,
              "branch_id must reference an active branch",
            );
          }
        }
        if (effectiveCourierId !== null) {
          const activeCourier = await client.query(
            "SELECT 1 FROM couriers WHERE courier_id = $1 AND is_active",
            [effectiveCourierId],
          );
          if (!activeCourier.rowCount) {
            throw createHttpError(
              400,
              "courier_id must reference an active courier",
            );
          }
        }
      }

      const current = await client.query(
        `SELECT status_update, courier_id, branch_id
           FROM tracking_logs
          WHERE parcel_id = $1
          ORDER BY scanned_at DESC, log_id DESC
          LIMIT 1`,
        [parcelId],
      );
      const currentStatus = current.rows[0]?.status_update;

      if (!isPrivileged) {
        // Write scope mirrors the anti-leak GET: history on this parcel, or an
        // unassigned branch-pool match by strict equality (no NULL-to-NULL match).
        // Checked BEFORE the transition rule so an out-of-scope courier gets 404,
        // never a 400 that leaks the parcel's current status.
        const history = await client.query(
          `SELECT EXISTS (
             SELECT 1 FROM tracking_logs h
              WHERE h.parcel_id = $1 AND h.courier_id = $2
           ) AS visible`,
          [parcelId, effectiveCourierId],
        );
        const latest = current.rows[0];
        const inBranchPool =
          !!latest &&
          latest.courier_id === null &&
          latest.branch_id !== null &&
          effectiveBranchId !== null &&
          latest.branch_id === effectiveBranchId;
        if (!history.rows[0].visible && !inBranchPool) {
          throw createHttpError(404, `Parcel ${parcelId} not found`);
        }
      }

      // The checkpoint transition map binds every role. Couriers additionally
      // cannot submit 'Cancelled'; that split lives in canCourierSubmitTrackingStatus.
      const statusRule = isPrivileged
        ? canSubmitTrackingStatus(currentStatus, status_update, returnTriggered)
        : canCourierSubmitTrackingStatus(
            currentStatus,
            status_update,
            returnTriggered,
          );
      if (!statusRule.allowed) {
        throw createHttpError(400, statusRule.message);
      }

      if (effectiveBranchId === null) {
        const carried = await client.query(
          `SELECT branch_id
             FROM tracking_logs
            WHERE parcel_id = $1 AND branch_id IS NOT NULL
            ORDER BY scanned_at DESC, log_id DESC
            LIMIT 1`,
          [parcelId],
        );
        effectiveBranchId = carried.rows[0]?.branch_id ?? null;
      }

      // Cancelled is coordinator/admin-only (never courier-submitted) and has no
      // account data to auto-generate a reason from -- the remark IS the
      // cancellation reason, so it's required here explicitly.
      if (
        status_update === "Cancelled" &&
        !(typeof remarks === "string" && remarks.trim())
      ) {
        throw createHttpError(
          400,
          "remarks (cancellation reason) is required to cancel a parcel",
        );
      }

      // A Delivery Failed scan must name the reason: it drives the retry-vs-return
      // decision (hard reason opens the return leg immediately). Require exactly
      // one of the known reasons, all roles.
      if (status_update === "Delivery Failed") {
        const trimmed = typeof remarks === "string" ? remarks.trim() : "";
        if (!FAIL_REASONS.includes(trimmed)) {
          throw createHttpError(
            400,
            `remarks (failure reason) is required for Delivery Failed and must be one of: ${FAIL_REASONS.join(", ")}`,
          );
        }
      }

      let effectiveRemarks =
        typeof remarks === "string" && remarks.trim() ? remarks.trim() : null;
      if (
        !isPrivileged &&
        (status_update === "Delivered" || status_update === "Returned")
      ) {
        const pod = await client.query(
          `SELECT c.full_name, b.business_name
             FROM parcels p
             JOIN businesses b
               ON b.business_id = CASE
                    WHEN $3 = 'Returned' THEN p.sender_id
                    ELSE p.receiver_id
                  END
             JOIN couriers c ON c.courier_id = $2
            WHERE p.parcel_id = $1`,
          [parcelId, effectiveCourierId, status_update],
        );
        effectiveRemarks = `${pod.rows[0].full_name} → ${pod.rows[0].business_name}`;
      }
      // Branch checkpoint scans auto-generate remarks from the branch name so the
      // log reads with the real hub instead of a generic label. Courier-only,
      // same pattern as the Delivered/Returned POD override above.
      if (
        !isPrivileged &&
        (status_update === "Arrived at Branch" ||
          status_update === "Departed Branch")
      ) {
        const branch = await client.query(
          "SELECT branch_name FROM branches WHERE branch_id = $1",
          [effectiveBranchId],
        );
        const branchName = branch.rows[0]?.branch_name ?? "branch checkpoint";
        effectiveRemarks =
          status_update === "Arrived at Branch"
            ? `Arrived at ${branchName}`
            : `Departed from ${branchName}`;
      }

      // Coordinator/admin logs without courier_id deliberately unassign the
      // parcel back to the effective branch pool; courier_id is not carried.
      // suggested_courier_id on the parcel detail is not applied here: an
      // explicit courier_id is kept, and an omitted one stays null.
      const { rows } = await client.query(
        `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id, recorded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          parcelId,
          status_update,
          effectiveRemarks,
          effectiveBranchId,
          effectiveCourierId,
          req.auth.user.user_id,
        ],
      );

      // Late routing (Sprint 13 §8.3): a parcel created branchless (resolver
      // miss) gets its planned-route snapshot on the FIRST scan that carries a
      // branch, inside this same transaction.
      if (effectiveBranchId !== null) {
        const hasSnapshot = await client.query(
          "SELECT 1 FROM parcel_route_stops WHERE parcel_id = $1 LIMIT 1",
          [parcelId],
        );
        if (!hasSnapshot.rowCount) {
          await createInitialRouteSnapshot(client, parcelId, effectiveBranchId);
        }
      }

      // Terminal delivery scans complete the linked marketplace order -- the
      // wholesaler's fulfillment control ended at 'shipped'
      // (docs/API_CONTRACTS.md §3.6).
      // COD settles at the terminal scan: Delivered collects, Returned fails.
      if (status_update === "Delivered") {
        await client.query(
          `UPDATE payments
              SET payment_status = 'Paid', paid_at = CURRENT_TIMESTAMP
            WHERE parcel_id = $1 AND method = 'COD' AND payment_status = 'Pending'`,
          [parcelId],
        );
      }
      if (status_update === "Returned" || status_update === "Cancelled") {
        await client.query(
          `UPDATE payments
              SET payment_status = 'Failed'
            WHERE parcel_id = $1 AND method = 'COD' AND payment_status = 'Pending'`,
          [parcelId],
        );
      }

      if (status_update === "Delivered") {
        const { rows: orderRows } = await client.query(
          `UPDATE orders o
              SET status = 'delivered', status_updated_by = $2, updated_at = CURRENT_TIMESTAMP
             FROM parcels p
            WHERE p.parcel_id = $1
              AND o.order_id = p.order_id
              AND o.status = 'shipped'
          RETURNING o.order_id, o.buyer_business_id`,
          [parcelId, req.auth.user.user_id],
        );
        if (orderRows.length) {
          await notifyBusiness(
            client,
            orderRows[0].buyer_business_id,
            "Order Delivered",
            `Order #${orderRows[0].order_id} is now delivered.`,
            "success",
          );
        }
      }

      // Fire the return-leg notification exactly once, on the fail that triggers
      // the return. Trigger = this fail carries a hard reason, OR it is the
      // RETURN_TRIGGER_FAILS-th fail. !returnTriggered is the fire-once guard.
      const thisFailTriggersReturn =
        isHardFailReason(effectiveRemarks) ||
        failedAttempts + 1 >= RETURN_TRIGGER_FAILS;
      if (
        status_update === "Delivery Failed" &&
        !returnTriggered &&
        thisFailTriggersReturn
      ) {
        const { rows: orderRows } = await client.query(
          `SELECT o.order_id, o.buyer_business_id, o.wholesaler_business_id
             FROM parcels p
             JOIN orders o ON o.order_id = p.order_id
            WHERE p.parcel_id = $1`,
          [parcelId],
        );
        if (orderRows.length) {
          const order = orderRows[0];
          const reason = effectiveRemarks
            ? effectiveRemarks.replace(/[.]+$/, "")
            : "reason not recorded";
          const message = isHardFailReason(effectiveRemarks)
            ? `Delivery cannot be completed: ${reason}. No further attempts will be made; the parcel for order #${order.order_id} is being returned to the wholesaler.`
            : `Delivery failed after 3 attempts: ${reason}. No further attempts will be made; the parcel for order #${order.order_id} is being returned to the wholesaler.`;
          await notifyBusiness(
            client,
            order.buyer_business_id,
            "Delivery Failed - Parcel Returning to Sender",
            message,
            "warning",
          );
          await notifyBusiness(
            client,
            order.wholesaler_business_id,
            "Delivery Failed - Parcel Returning to Sender",
            message,
            "warning",
          );
        }
      }

      if (status_update === "Returned") {
        const { rows: orderRows } = await client.query(
          `UPDATE orders o
              SET status = 'returned', status_updated_by = $2, updated_at = CURRENT_TIMESTAMP
             FROM parcels p
            WHERE p.parcel_id = $1
              AND o.order_id = p.order_id
              AND o.status = 'shipped'
          RETURNING o.order_id, o.buyer_business_id, o.wholesaler_business_id`,
          [parcelId, req.auth.user.user_id],
        );
        if (orderRows.length) {
          const order = orderRows[0];
          // Buyer is deliberately NOT notified here (AGENT_HANDOFF §7 / §9.3 decision
          // A): they went silent after the 3rd Delivery Failed, which already told
          // them "no 4th attempt, returning to sender". Wholesaler only.
          await notifyBusiness(
            client,
            order.wholesaler_business_id,
            "Parcel Returned to You",
            `Order #${order.order_id} returned to sender. Parcel was received by your business.`,
            "warning",
          );
        }
      }

      // Cancelled is a coordinator/admin override (Sprint 11), guarded on
      // status = 'shipped' like Delivered/Returned so a cancel after some other
      // terminal state never rewrites the order. Both parties are notified.
      if (status_update === "Cancelled") {
        const { rows: orderRows } = await client.query(
          `UPDATE orders o
              SET status = 'cancelled', status_updated_by = $2, updated_at = CURRENT_TIMESTAMP
             FROM parcels p
            WHERE p.parcel_id = $1
              AND o.order_id = p.order_id
              AND o.status = 'shipped'
          RETURNING o.order_id, o.buyer_business_id, o.wholesaler_business_id`,
          [parcelId, req.auth.user.user_id],
        );
        if (orderRows.length) {
          const order = orderRows[0];
          await restoreOrderStock(client, order.order_id);
          const message = `Order #${order.order_id} was cancelled: ${effectiveRemarks}`;
          await notifyBusiness(
            client,
            order.buyer_business_id,
            "Order Cancelled",
            message,
            "warning",
          );
          await notifyBusiness(
            client,
            order.wholesaler_business_id,
            "Order Cancelled",
            message,
            "warning",
          );
        }
      }

      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      next(asClientError(error));
    } finally {
      client.release();
    }
  },
);

export default router;
