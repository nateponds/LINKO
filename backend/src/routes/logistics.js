import { Router } from "express";
import { query, getPool, nextParcelId } from "../db.js";
import { requireAnyRole, requireAuth } from "../middleware/auth.js";
import {
  getActiveMembership,
  isPlatformAdmin,
  resolveActiveBusinessId,
} from "../middleware/ownership.js";
import { notifyBusiness } from "../services/notify.js";
import {
  computeRouteDistanceKm,
  createInitialRouteSnapshot,
  resolveInitialBranchId,
} from "../services/parcelRouting.js";
import { validateCoordinatePair } from "../services/location.js";
import {
  buildPaginatedResponse,
  parsePaginationQuery,
} from "../services/pagination.js";

const router = Router();

const VALID_TRACKING_STATUSES = [
  "Order Created",
  "Picked Up",
  "Arrived at Branch",
  "Departed Branch",
  "Out for Delivery",
  "Delivery Failed",
  "Out for Return",
  "Delivered",
  "Returned",
  "Cancelled",
];
const TERMINAL_TRACKING_STATUSES = new Set(["Delivered", "Returned", "Cancelled"]);
const TERMINAL_TRACKING_STATUS_LIST = [...TERMINAL_TRACKING_STATUSES];
const PARCEL_ASSIGNMENTS = new Set(["available", "active", "completed"]);
const RETURN_TRIGGER_FAILS = 3;
const BRANCH_ADDRESS_FIELDS = [
  "province",
  "city_municipality",
  "barangay",
  "street_address",
  "postal_code",
];
const REQUIRED_BRANCH_FIELDS = ["branch_name", "province", "city_municipality"];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function clientError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function readOptionalQueryString(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw clientError(`${name} must be a single string`);
  }
  return value;
}

// Filter parsing stays beside the logistics routes because status and
// assignment are domain concepts; shared page/q parsing lives in pagination.
export function parseParcelListQuery(query) {
  const pagination = parsePaginationQuery(query);
  const status = readOptionalQueryString(query, "status");
  const assignment = readOptionalQueryString(query, "assignment");

  if (status !== undefined && !VALID_TRACKING_STATUSES.includes(status)) {
    throw clientError("status must be a valid tracking status");
  }
  if (assignment !== undefined && !PARCEL_ASSIGNMENTS.has(assignment)) {
    throw clientError("assignment must be one of available, active, or completed");
  }
  return { ...pagination, status, assignment };
}

function normalizeBranchText(body, field, { required = false } = {}) {
  if (!hasOwn(body, field)) {
    return undefined;
  }
  const value = body[field];
  if (value === null && !required) {
    return null;
  }
  if (typeof value !== "string" || (required && value.trim() === "")) {
    throw clientError(`${field} must be ${required ? "a non-empty string" : "a string or null"}`);
  }
  return value.trim();
}

async function selectBranch(db, branchId, { includeActive = false } = {}) {
  const { rows } = await db.query(
    `SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
            b.is_available${includeActive ? ", b.is_active" : ""},
            a.province, a.city_municipality, a.barangay, a.street_address,
            a.postal_code, a.latitude::float8 AS latitude,
            a.longitude::float8 AS longitude
       FROM branches b
       JOIN addresses a ON a.address_id = b.address_id
      WHERE b.branch_id = $1 AND b.is_active`,
    [branchId],
  );
  return rows[0] ?? null;
}

// Delivery failure reasons. A Delivery Failed scan must carry exactly one of
// these as its remark (enforced in POST /parcels/:id/tracking). Mirrors
// src/lib/statusWorkflow.js — keep both lists in sync.
const FAIL_REASONS = ["Receiver unavailable", "Delivery refused", "Bad address"];
// Hard reasons open the return leg immediately on the fail they occur, skipping
// the retry loop. Soft reasons (the remainder) get retries up to RETURN_TRIGGER_FAILS.
const HARD_FAIL_REASONS = ["Bad address", "Delivery refused"];
const isHardFailReason = (remarks) =>
  HARD_FAIL_REASONS.includes(typeof remarks === "string" ? remarks.trim() : remarks);

// The flow is non-linear (checkpoints repeat, delivery retries, the return leg
// retraces hubs "backwards"), so courier moves are an explicit transition map
// rather than an integer rank. The 'Delivery Failed' edge is count-aware:
// < 3 fails allows a retry, the 3rd fail opens the return leg — the count
// gates the transition, it never auto-writes 'Returned'.
const COURIER_TRANSITIONS = {
  "Order Created": ["Picked Up"],
  "Picked Up": ["Arrived at Branch", "Out for Delivery"],
  // Arrived can either depart for another hub (more transit) or go straight out
  // for delivery when this is the final hub -- no redundant Departed Branch scan
  // right before Out for Delivery. Count-gated return-leg edges are injected
  // in courierAllowedNextStatuses rather than this forward-journey map.
  "Arrived at Branch": ["Departed Branch", "Out for Delivery"],
  // Departed is never terminal -- it always means line-haul toward another node
  // or the final-hub delivery run. 'Returned' is NOT an edge off Departed.
  "Departed Branch": ["Arrived at Branch", "Out for Delivery"],
  "Out for Delivery": ["Delivered", "Delivery Failed"],
};

// returnTriggered is the derived return-leg signal: true once the retry cap is
// hit OR any prior fail carried a hard reason. Computed by the caller (the
// POST handler and the list query) — see isHardFailReason / RETURN_TRIGGER_FAILS.
export function courierAllowedNextStatuses(currentStatus, returnTriggered = false) {
  if (!currentStatus) return VALID_TRACKING_STATUSES.filter((s) => s !== "Cancelled");
  if (TERMINAL_TRACKING_STATUSES.has(currentStatus)) return [];
  if (currentStatus === "Delivery Failed") {
    return returnTriggered ? ["Arrived at Branch"] : ["Out for Delivery"];
  }
  // Return-leg movement is return-triggered here because the static forward map
  // has no fail state: branch arrival -> Out for Return -> Returned.
  // Ceiling: any Arrived-at-Branch scan qualifies -- the system does NOT verify
  // the branch is the sender's serving hub. Strict-hub enforcement (a
  // branch-service-area model) is deferred, see DETAILED_HANDOFF §7.
  if (currentStatus === "Arrived at Branch" && returnTriggered) {
    // Return leg is one-way: no redelivery or hub departure once the parcel
    // reaches the return branch. It must leave for the sender next.
    return ["Out for Return"];
  }
  if (currentStatus === "Out for Return") {
    return returnTriggered ? ["Returned"] : [];
  }
  return COURIER_TRANSITIONS[currentStatus] ?? [];
}

// Course-deliverable routes (Sprint 2-CD): expose the 002/003 logistics
// subsystem for the demo UI. Shapes documented in docs/API_CONTRACTS.md.

// PostgreSQL constraint violations mean the client sent bad references or
// values, not that the server broke. Map them to 400 instead of 500.
// 23503 = foreign key violation, 23514 = check violation, 23505 = unique.
function asClientError(error) {
  if (["23503", "23514", "23505"].includes(error.code)) {
    error.statusCode = 400;
  }
  return error;
}

export function canCourierSubmitTrackingStatus(currentStatus, nextStatus, returnTriggered = false) {
  if (nextStatus === "Cancelled") {
    return {
      allowed: false,
      message: "Couriers cannot cancel parcels; use Delivery Failed for failed delivery outcomes.",
    };
  }

  return canSubmitTrackingStatus(currentStatus, nextStatus, returnTriggered);
}

// The checkpoint transition map binds every role -- a coordinator/admin cannot
// skip 'Arrived at Branch'/'Departed Branch' either (handoff 2026-07-16 s2).
// The only privileged-exclusive move is 'Cancelled', a terminal escape hatch
// couriers are separately barred from (see canCourierSubmitTrackingStatus).
export function canSubmitTrackingStatus(currentStatus, nextStatus, returnTriggered = false) {
  if (nextStatus === "Cancelled") {
    return currentStatus && TERMINAL_TRACKING_STATUSES.has(currentStatus)
      ? { allowed: false, message: `Cannot update terminal parcel status ${currentStatus}` }
      : { allowed: true };
  }

  if (!currentStatus) return { allowed: true };

  if (TERMINAL_TRACKING_STATUSES.has(currentStatus)) {
    return {
      allowed: false,
      message: `Cannot update terminal parcel status ${currentStatus}`,
    };
  }

  const allowed = courierAllowedNextStatuses(currentStatus, returnTriggered);
  if (!allowed.includes(nextStatus)) {
    return {
      allowed: false,
      message: `Cannot move from ${currentStatus} to ${nextStatus}; allowed next: ${allowed.join(", ")}`,
    };
  }

  return { allowed: true };
}

// Current status lives in tracking_logs (latest row by scanned_at), never on
// parcels -- see docs/LINKO_ERD.md design notes.
const LATEST_LOG = `
  LEFT JOIN LATERAL (
    SELECT status_update, scanned_at, courier_id, branch_id
      FROM tracking_logs tl
     WHERE tl.parcel_id = p.parcel_id
     ORDER BY tl.scanned_at DESC, tl.log_id DESC
     LIMIT 1
  ) latest ON TRUE`;

// Buyers pass the gate only for the single-parcel read (track-my-order);
// the list below yields nothing for a buyer-only caller and every write
// route layers its own tighter requireAnyRole without "buyer".
router.use(
  "/parcels",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

router.use(
  "/service-tiers",
  requireAuth,
  requireAnyRole(["buyer", "wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

// Branches and couriers are logistics reference data. Reads (GET) were
// previously UNAUTHENTICATED; gate the whole path so only logistics-adjacent
// roles may read. Writes add their own tighter role guard per-route below.
router.use(
  "/branches",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

router.use(
  "/couriers",
  requireAuth,
  requireAnyRole(["wholesaler", "logistics_coordinator", "courier", "platform_admin"]),
);

// Row-level parcel visibility for the current caller:
//   { all: true }              -> logistics_coordinator or platform_admin
//   { businessIds: [...] }     -> wholesaler: parcels they send OR receive
//   { courierId, courierBranchId } -> courier: history plus branch pickup pool
//   receiverOnlyIds            -> buyer memberships: single-parcel reads where
//                                 they are the receiver; deliberately ignored
//                                 by the list so buyers never enumerate parcels
// Resolved once per request; used to build the WHERE clause in the house style.
async function parcelScope(req) {
  const { user, memberships } = req.auth;
  if (isPlatformAdmin(user)) {
    return { all: true };
  }

  // Scope to the ACTIVE business only. A wholesaler/buyer/courier business that
  // is not the current selection grants no parcel-list rows. Throws 400 for a
  // multi-business caller with no X-Active-Business, which Express 5 forwards to
  // the central errorHandler.
  const activeBusinessId = resolveActiveBusinessId(req);
  const activeMemberships = memberships.filter(
    (m) => m.business_id === activeBusinessId,
  );

  if (activeMemberships.some((m) => m.role === "logistics_coordinator")) {
    return { all: true };
  }

  const receiverOnlyIds = activeMemberships
    .filter((m) => m.role === "buyer")
    .map((m) => m.business_id);

  const businessIds = activeMemberships
    .filter((m) => m.role === "wholesaler")
    .map((m) => m.business_id);
  if (businessIds.length) {
    return { businessIds, receiverOnlyIds };
  }

  // Only reach the courier pool when the active business is a courier business;
  // otherwise a buyer-active context would leak the courier's handling pool.
  // A buyer-only active business lists no parcels (it may still read a single
  // parcel it receives via receiverOnlyIds on the detail route).
  if (!activeMemberships.some((m) => m.role === "courier")) {
    return { none: true, receiverOnlyIds };
  }

  const { rows } = await query(
    "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = $1 AND is_active",
    [user.user_id],
  );
  return {
    courierId: rows[0]?.courier_id ?? null,
    courierBranchId: rows[0]?.assigned_branch_id ?? null,
    receiverOnlyIds,
  };
}

function parcelListBaseFilter(scope, filters) {
  const params = [];
  const clauses = [];

  if (scope.businessIds) {
    params.push(scope.businessIds);
    clauses.push(`(p.sender_id = ANY($${params.length}::int[])
                  OR p.receiver_id = ANY($${params.length}::int[]))`);
  } else if (scope.courierId !== undefined && !scope.all) {
    params.push(scope.courierId);
    const courierParam = params.length;
    const historyClause = `EXISTS (SELECT 1 FROM tracking_logs h
               WHERE h.parcel_id = p.parcel_id AND h.courier_id = $${courierParam})`;
    if (scope.courierBranchId !== null) {
      params.push(scope.courierBranchId);
      clauses.push(`(${historyClause}
        OR (latest.courier_id IS NULL AND latest.branch_id = $${params.length}))`);
    } else {
      clauses.push(`(${historyClause})`);
    }
  }

  if (filters.q) {
    params.push(filters.q);
    const qParam = params.length;
    clauses.push(`(p.parcel_id ILIKE '%' || $${qParam} || '%'
      OR s.business_name ILIKE '%' || $${qParam} || '%'
      OR r.business_name ILIKE '%' || $${qParam} || '%')`);
  }
  if (filters.status) {
    params.push(filters.status);
    clauses.push(`latest.status_update = $${params.length}`);
  }
  return { params, clause: clauses.join(" AND ") };
}

function assignmentClause(assignment, terminalParam) {
  const nonterminal = `(latest.status_update IS NULL
    OR latest.status_update <> ALL($${terminalParam}::text[]))`;
  if (assignment === "available") return `latest.courier_id IS NULL AND ${nonterminal}`;
  if (assignment === "active") return `latest.courier_id IS NOT NULL AND ${nonterminal}`;
  if (assignment === "completed") return `latest.status_update = ANY($${terminalParam}::text[])`;
  return null;
}

router.get("/parcels", async (req, res) => {
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
  const selectedAssignment = assignmentClause(filters.assignment, terminalParam);
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
       ${LATEST_LOG}
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
  const { rows } = await query(`
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
      ${LATEST_LOG}
      ${filterClause ? `WHERE ${filterClause}` : ""}
     ORDER BY latest.scanned_at DESC NULLS LAST, p.parcel_id ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`, params);

  const counts = countRows[0];
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
});

router.get("/parcels/:id", async (req, res) => {
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
      ${LATEST_LOG}
     WHERE p.parcel_id = $1`,
    [req.params.id],
  );

  if (!rows.length) {
    return res.status(404).json({
      error: { message: `Parcel ${req.params.id} not found` },
    });
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
    return res.status(404).json({
      error: { message: `Parcel ${req.params.id} not found` },
    });
  }

  // Buyer visibility cutoff (AGENT_HANDOFF §9.3): a caller who sees this parcel
  // ONLY as its receiver (buyer-side) must not see the return leg. Once the
  // return leg is triggered, truncate their tracking_history at and including
  // the fail that triggered it -- everything after is the internal
  // LINKO<->wholesaler return journey. The trigger is the 3rd 'Delivery Failed'
  // (soft-retry cap) OR the first fail carrying a hard reason, whichever comes
  // first. All other callers (sender/wholesaler, courier, coordinator, admin)
  // get the full history.
  const isReceiverOnlyView =
    !scope.all &&
    !(scope.businessIds && scope.businessIds.includes(parcel.sender_id)) &&
    scope.courierId === undefined &&
    (scope.receiverOnlyIds?.includes(parcel.receiver_id) ?? false);
  if (isReceiverOnlyView && Array.isArray(parcel.tracking_history)) {
    let failsSeen = 0;
    let cutoffIndex = -1;
    for (let i = 0; i < parcel.tracking_history.length; i += 1) {
      const row = parcel.tracking_history[i];
      if (row.status_update === "Delivery Failed") {
        failsSeen += 1;
        if (failsSeen >= RETURN_TRIGGER_FAILS || isHardFailReason(row.remarks)) {
          cutoffIndex = i;
          break;
        }
      }
    }
    // Only truncate when a triggering fail was actually found (return leg
    // exists). No trigger -> full timeline, including in-progress soft retries.
    if (cutoffIndex !== -1) {
      parcel.current_status =
        parcel.tracking_history[cutoffIndex].status_update;
      parcel.latest_courier_id = null;
      parcel.latest_branch_id = null;
      parcel.tracking_history = parcel.tracking_history.slice(0, cutoffIndex + 1);
    }
  }

  // Strip the internal-only fields used for the ownership check.
  delete parcel.sender_id;
  delete parcel.receiver_id;

  res.json(parcel);
});

router.post(
  "/parcels",
  requireAnyRole(["wholesaler", "logistics_coordinator", "platform_admin"]),
  async (req, res, next) => {
  // Sprint 13: total_distance_km is no longer read from the body — the
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
    return res.status(400).json({
      error: { message: `Missing required fields: ${missing.join(", ")}` },
    });
  }
  if (Number(weight_kg) <= 0 || Number.isNaN(Number(weight_kg))) {
    return res.status(400).json({
      error: { message: "weight_kg must be a number greater than 0" },
    });
  }
  if (!["COD", "Prepaid", "Online"].includes(payment_method)) {
    return res.status(400).json({
      error: { message: "payment_method must be one of COD, Prepaid, Online" },
    });
  }

  // Sender must be derived from the caller's own business, never trusted from
  // the body. A wholesaler can only send parcels as one of their businesses:
  // resolve the active wholesaler membership and reject any body sender_id that
  // does not match it. Logistics coordinators and platform admins operate the
  // whole network, so they may book on behalf of any sender business.
  let effectiveSenderId = sender_id;
  const isWholesaler = req.auth.memberships.some((m) => m.role === "wholesaler");
  if (!isPlatformAdmin(req.auth.user) && isWholesaler) {
    let ownBusinessId;
    try {
      ownBusinessId = getActiveMembership(req, ["wholesaler"]).business_id;
    } catch (error) {
      return next(error);
    }
    if (Number(sender_id) !== ownBusinessId) {
      return res.status(403).json({
        error: { message: "sender_id must be your own business" },
      });
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
      throw Object.assign(new Error("origin_address_id must belong to the sender business"), {
        statusCode: 400,
      });
    }
    if (!destination || destination.business_id !== Number(receiver_id)) {
      throw Object.assign(new Error("destination_address_id must belong to the receiver business"), {
        statusCode: 400,
      });
    }

    // Pin gate (Sprint 13): pricing distance needs both endpoints. BLOCK,
    // not degrade — pre-launch means there is no legacy class to grandfather.
    if (
      origin.latitude === null || origin.longitude === null ||
      destination.latitude === null || destination.longitude === null
    ) {
      throw Object.assign(
        new Error("Origin and destination addresses must have coordinates before booking"),
        { statusCode: 409 },
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
    const originBranchId = await resolveInitialBranchId(client, origin_address_id);

    await client.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id)
       VALUES ($1, 'Order Created', 'Booking confirmed', $2)`,
      [parcelId, originBranchId],
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
});

router.get("/service-tiers", async (_req, res) => {
  const { rows } = await query(`
    SELECT tier_id, tier_name, base_fee::float8, base_rate_per_kg::float8,
           rate_per_km::float8, estimated_days
      FROM service_tiers
     ORDER BY tier_id`);

  res.json(rows);
});

router.put(
  "/service-tiers/:id",
  requireAnyRole(["platform_admin"]),
  async (req, res, next) => {
    const tierId = Number(req.params.id);
    const { tier_name, base_fee, base_rate_per_kg, rate_per_km, estimated_days } = req.body;

    // Validate required fields
    if (!tier_name || typeof tier_name !== "string" || !tier_name.trim()) {
      return res.status(400).json({
        error: { message: "tier_name is required" },
      });
    }

    const numBaseFee = Number(base_fee);
    const numBaseRate = Number(base_rate_per_kg);
    const numRateKm = Number(rate_per_km);
    const numDays = Number(estimated_days);

    if ([numBaseFee, numBaseRate, numRateKm].some((v) => Number.isNaN(v) || v < 0)) {
      return res.status(400).json({
        error: { message: "base_fee, base_rate_per_kg, and rate_per_km must be numbers >= 0" },
      });
    }
    if (Number.isNaN(numDays) || !Number.isInteger(numDays) || numDays < 1) {
      return res.status(400).json({
        error: { message: "estimated_days must be an integer >= 1" },
      });
    }

    try {
      const { rows } = await query(
        `UPDATE service_tiers
            SET tier_name = $1, base_fee = $2, base_rate_per_kg = $3,
                rate_per_km = $4, estimated_days = $5
          WHERE tier_id = $6
          RETURNING tier_id, tier_name, base_fee::float8, base_rate_per_kg::float8,
                    rate_per_km::float8, estimated_days`,
        [tier_name.trim(), numBaseFee, numBaseRate, numRateKm, numDays, tierId],
      );

      if (!rows.length) {
        return res.status(404).json({
          error: { message: "Service tier not found" },
        });
      }

      res.json(rows[0]);
    } catch (error) {
      next(asClientError(error));
    }
  },
);

router.get("/branches", async (req, res) => {
  const filters = parsePaginationQuery(req.query);
  const params = [];
  let search = "";
  if (filters.q) {
    params.push(filters.q);
    const qParam = params.length;
    search = ` AND (b.branch_name ILIKE '%' || $${qParam} || '%'
      OR a.province ILIKE '%' || $${qParam} || '%'
      OR a.city_municipality ILIKE '%' || $${qParam} || '%'
      OR a.barangay ILIKE '%' || $${qParam} || '%')`;
  }
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total_items
       FROM branches b
       JOIN addresses a ON a.address_id = b.address_id
      WHERE b.is_active${search}`,
    params,
  );
  params.push(filters.limit, filters.offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;
  const { rows } = await query(`
    SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
           b.is_available,
           a.province, a.city_municipality, a.barangay, a.street_address,
           a.postal_code, a.latitude::float8 AS latitude,
           a.longitude::float8 AS longitude
      FROM branches b
      JOIN addresses a ON a.address_id = b.address_id
     WHERE b.is_active${search}
     ORDER BY b.branch_id ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`, params);
  res.json(buildPaginatedResponse(rows, filters, countRows[0].total_items));
});

router.get("/branches/options", async (_req, res) => {
  const { rows } = await query(`
    SELECT branch_id, branch_name
      FROM branches
     WHERE is_active
     ORDER BY branch_name ASC, branch_id ASC`);
  res.json(rows);
});

router.get("/couriers", async (req, res) => {
  const filters = parsePaginationQuery(req.query);
  const params = [];
  let search = "";
  if (filters.q) {
    params.push(filters.q);
    const qParam = params.length;
    search = ` AND (c.full_name ILIKE '%' || $${qParam} || '%'
      OR c.phone_number ILIKE '%' || $${qParam} || '%'
      OR c.vehicle_type ILIKE '%' || $${qParam} || '%'
      OR b.branch_name ILIKE '%' || $${qParam} || '%')`;
  }
  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total_items
       FROM couriers c
       LEFT JOIN branches b ON b.branch_id = c.assigned_branch_id
      WHERE c.is_active${search}`,
    params,
  );
  params.push(filters.limit, filters.offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;
  const { rows } = await query(`
    SELECT c.courier_id, c.full_name, c.phone_number, c.vehicle_type,
           c.assigned_branch_id, b.branch_name AS assigned_branch_name
      FROM couriers c
      LEFT JOIN branches b ON b.branch_id = c.assigned_branch_id
     WHERE c.is_active${search}
     ORDER BY c.full_name ASC, c.courier_id ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`, params);
  res.json(buildPaginatedResponse(rows, filters, countRows[0].total_items));
});

router.get("/couriers/options", async (_req, res) => {
  const { rows } = await query(`
    SELECT courier_id, full_name
      FROM couriers
     WHERE is_active
     ORDER BY full_name ASC, courier_id ASC`);
  res.json(rows);
});

router.post("/parcels/:id/tracking", requireAnyRole(["logistics_coordinator", "courier", "platform_admin"]), async (req, res, next) => {
  const parcelId = req.params.id;
  const { status_update, remarks, branch_id, courier_id } = req.body ?? {};

  if (!VALID_TRACKING_STATUSES.includes(status_update)) {
    return res.status(400).json({
      error: { message: "Invalid status_update" },
    });
  }

  // Couriers act as themselves: stamp courier_id and home branch from their
  // linked couriers row and ignore client-supplied values (no spoofing).
  // Coordinators/admins may assign explicitly.
  let effectiveCourierId = courier_id || null;
  let effectiveBranchId = branch_id || null;
  const isPrivileged =
    isPlatformAdmin(req.auth.user) ||
    req.auth.memberships.some((m) => m.role === "logistics_coordinator");
  if (!isPrivileged) {
    const { rows } = await query(
      "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = $1 AND is_active",
      [req.auth.user.user_id],
    );
    if (!rows.length) {
      return res.status(403).json({
        error: { message: "Your account is not linked to an active courier profile" },
      });
    }
    effectiveCourierId = rows[0].courier_id;
    effectiveBranchId = rows[0].assigned_branch_id ?? null;
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
      const error = new Error(`Parcel ${parcelId} not found`);
      error.statusCode = 404;
      throw error;
    }

    // Fail count is derived, never stored on parcels — parcel state lives only
    // in tracking_logs (docs/LINKO_ERD.md design notes). It gates the courier
    // Delivery Failed edge and fires the 3rd-fail notification below.
    // Counts 'Delivery Failed' rows, not 'Out for Delivery' rows: OFD is
    // ambiguous (≠ failure) and counting it would trip the return leg the instant
    // the 3rd OFD scans — before attempt #3 actually fails. The explicit failure
    // event is recorded, not inferred. A derived count also can't drift the way a
    // stored delivery_attempts column would.
    const failCount = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM tracking_logs
        WHERE parcel_id = $1 AND status_update = 'Delivery Failed'`,
      [parcelId],
    );
    const failedAttempts = failCount.rows[0].n;

    // Return-leg signal for gating, derived from history BEFORE this insert:
    // the retry cap was already reached, OR a prior fail carried a hard reason.
    // A parcel still in the retry loop can only have soft fails (a hard reason
    // would already have triggered the return), so this and failedAttempts stay
    // coherent. The current scan's own reason is folded into the notification
    // guard below, not here.
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
          const error = new Error("branch_id must reference an active branch");
          error.statusCode = 400;
          throw error;
        }
      }
      if (effectiveCourierId !== null) {
        const activeCourier = await client.query(
          "SELECT 1 FROM couriers WHERE courier_id = $1 AND is_active",
          [effectiveCourierId],
        );
        if (!activeCourier.rowCount) {
          const error = new Error("courier_id must reference an active courier");
          error.statusCode = 400;
          throw error;
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
        const error = new Error(`Parcel ${parcelId} not found`);
        error.statusCode = 404;
        throw error;
      }
    }

    // The checkpoint transition map binds every role. Couriers additionally
    // cannot submit 'Cancelled'; that split lives in canCourierSubmitTrackingStatus.
    const statusRule = isPrivileged
      ? canSubmitTrackingStatus(currentStatus, status_update, returnTriggered)
      : canCourierSubmitTrackingStatus(currentStatus, status_update, returnTriggered);
    if (!statusRule.allowed) {
      const error = new Error(statusRule.message);
      error.statusCode = 400;
      throw error;
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

    // Terminal courier scans auto-generate proof from accounts. Delivered names
    // the receiver business; Returned names the sender business that physically
    // receives the parcel back. Businesses, not individual users, are the parcel
    // parties: parcels.receiver_id -> businesses (no person), and businesses<->users
    // is many-to-many, so picking any single users.full_name would be a fabricated
    // POD. The business name is the only non-invented party we can name.
    // Coordinators/admins keep the manual-remark override.
    // Cancelled is coordinator/admin-only (never courier-submitted) and, unlike
    // Delivered/Returned, has no account data to auto-generate a reason from --
    // the remark IS the cancellation reason, so it's required here explicitly.
    if (status_update === "Cancelled" && !(typeof remarks === "string" && remarks.trim())) {
      const error = new Error("remarks (cancellation reason) is required to cancel a parcel");
      error.statusCode = 400;
      throw error;
    }

    // A Delivery Failed scan must name the reason: it drives the retry-vs-return
    // decision (hard reason opens the return leg immediately). Require exactly
    // one of the known reasons, all roles -- the courier UI's picker already
    // sends these; free text from a coordinator/admin is rejected here.
    if (status_update === "Delivery Failed") {
      const trimmed = typeof remarks === "string" ? remarks.trim() : "";
      if (!FAIL_REASONS.includes(trimmed)) {
        const error = new Error(
          `remarks (failure reason) is required for Delivery Failed and must be one of: ${FAIL_REASONS.join(", ")}`,
        );
        error.statusCode = 400;
        throw error;
      }
    }

    let effectiveRemarks = typeof remarks === "string" && remarks.trim() ? remarks.trim() : null;
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
      (status_update === "Arrived at Branch" || status_update === "Departed Branch")
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
    const { rows } = await client.query(
      `INSERT INTO tracking_logs (parcel_id, status_update, remarks, branch_id, courier_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [parcelId, status_update, effectiveRemarks, effectiveBranchId, effectiveCourierId]
    );

    // Late routing (Sprint 13 §8.3): a parcel created branchless (resolver
    // miss) gets its planned-route snapshot on the FIRST scan that carries a
    // branch, inside this same transaction. Guarded on no-snapshot-exists so
    // later reassignments and hub transfers never touch the original plan;
    // the (parcel_id, stop_order) PK conflict clause makes retries idempotent
    // even if two scans race past this check.
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
    // Guard on Pending so coordinator corrections after a terminal scan do
    // not rewrite already-settled payments.
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
            SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
           FROM parcels p
          WHERE p.parcel_id = $1
            AND o.order_id = p.order_id
            AND o.status = 'shipped'
        RETURNING o.order_id, o.buyer_business_id`,
        [parcelId],
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

    // Order-side effects are split across the return flow (AGENT_HANDOFF §7):
    // the 3rd Delivery Failed notifies both parties that the return leg is
    // beginning (no money/order change), and the final Returned scan — the
    // terminal scan back at the sender — settles the order and payment.
    // Fire the return-leg notification exactly once, on the fail that triggers
    // the return. Trigger = this fail carries a hard reason, OR it is the
    // RETURN_TRIGGER_FAILS-th fail. !returnTriggered is the fire-once guard:
    // returnTriggered was computed from history BEFORE this insert, so it is
    // false on the triggering fail and true on any fail after it.
    const thisFailTriggersReturn =
      isHardFailReason(effectiveRemarks) ||
      failedAttempts + 1 >= RETURN_TRIGGER_FAILS;
    if (status_update === "Delivery Failed" && !returnTriggered && thisFailTriggersReturn) {
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
          "Delivery Failed — Parcel Returning to Sender",
          message,
          "warning",
        );
        await notifyBusiness(
          client,
          order.wholesaler_business_id,
          "Delivery Failed — Parcel Returning to Sender",
          message,
          "warning",
        );
      }
    }

    if (status_update === "Returned") {
      const { rows: orderRows } = await client.query(
        `UPDATE orders o
            SET status = 'returned', updated_at = CURRENT_TIMESTAMP
           FROM parcels p
          WHERE p.parcel_id = $1
            AND o.order_id = p.order_id
            AND o.status = 'shipped'
        RETURNING o.order_id, o.buyer_business_id, o.wholesaler_business_id`,
        [parcelId],
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
    // terminal state never rewrites the order. Both parties are notified,
    // unlike Returned's wholesaler-only notice, since neither side initiated it.
    if (status_update === "Cancelled") {
      const { rows: orderRows } = await client.query(
        `UPDATE orders o
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
           FROM parcels p
          WHERE p.parcel_id = $1
            AND o.order_id = p.order_id
            AND o.status = 'shipped'
        RETURNING o.order_id, o.buyer_business_id, o.wholesaler_business_id`,
        [parcelId],
      );
      if (orderRows.length) {
        const order = orderRows[0];
        const message = `Order #${order.order_id} was cancelled: ${effectiveRemarks}`;
        await notifyBusiness(client, order.buyer_business_id, "Order Cancelled", message, "warning");
        await notifyBusiness(client, order.wholesaler_business_id, "Order Cancelled", message, "warning");
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
});


router.post("/branches", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const body = req.body ?? {};
    const text = {};
    for (const field of ["branch_name", "contact_number", ...BRANCH_ADDRESS_FIELDS]) {
      text[field] = normalizeBranchText(body, field, {
        required: REQUIRED_BRANCH_FIELDS.includes(field),
      });
    }
    for (const field of REQUIRED_BRANCH_FIELDS) {
      if (text[field] === undefined) {
        throw clientError(`${field} is required`);
      }
    }

    const latitudeProvided = hasOwn(body, "latitude");
    const longitudeProvided = hasOwn(body, "longitude");
    if (latitudeProvided !== longitudeProvided) {
      throw clientError("latitude and longitude must be provided together");
    }
    const coords = validateCoordinatePair(body.latitude, body.longitude);
    if (!coords.ok) {
      throw clientError(coords.error);
    }

    await client.query("BEGIN");
    const addr = await client.query(
      `INSERT INTO addresses
         (province, city_municipality, barangay, street_address, postal_code, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING address_id`,
      [
        text.province,
        text.city_municipality,
        text.barangay ?? null,
        text.street_address ?? null,
        text.postal_code ?? null,
        coords.latitude,
        coords.longitude,
      ],
    );
    const branch = await client.query(
      `INSERT INTO branches (branch_name, contact_number, address_id)
       VALUES ($1, $2, $3) RETURNING branch_id`,
      [text.branch_name, text.contact_number ?? null, addr.rows[0].address_id],
    );
    const created = await selectBranch(client, branch.rows[0].branch_id, {
      includeActive: true,
    });
    await client.query("COMMIT");
    res.status(201).json(created);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(e));
  } finally {
    client.release();
  }
});

// Partial branch management update. Branch metadata and its ownerless address
// are locked and changed in one transaction so callers never observe a mixed
// old/new location. An availability-only PATCH deliberately leaves the address
// untouched; an explicit null coordinate pair unpins the branch.
router.patch("/branches/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  const client = await getPool().connect();
  try {
    const body = req.body ?? {};
    const text = {};
    for (const field of ["branch_name", "contact_number", ...BRANCH_ADDRESS_FIELDS]) {
      text[field] = normalizeBranchText(body, field, {
        required: REQUIRED_BRANCH_FIELDS.includes(field),
      });
    }
    if (hasOwn(body, "is_available") && typeof body.is_available !== "boolean") {
      throw clientError("is_available must be a boolean");
    }

    const latitudeProvided = hasOwn(body, "latitude");
    const longitudeProvided = hasOwn(body, "longitude");
    if (latitudeProvided !== longitudeProvided) {
      throw clientError("latitude and longitude must be provided together");
    }
    const coordinatesProvided = latitudeProvided;
    const coords = coordinatesProvided
      ? validateCoordinatePair(body.latitude, body.longitude)
      : null;
    if (coords && !coords.ok) {
      throw clientError(coords.error);
    }
    const addressUpdateProvided =
      BRANCH_ADDRESS_FIELDS.some((field) => hasOwn(body, field)) || coordinatesProvided;
    const branchUpdateProvided =
      hasOwn(body, "branch_name") ||
      hasOwn(body, "contact_number") ||
      hasOwn(body, "is_available");

    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT b.branch_id, b.branch_name, b.contact_number, b.address_id,
              b.is_available, a.province, a.city_municipality, a.barangay,
              a.street_address, a.postal_code, a.latitude, a.longitude
         FROM branches b
         JOIN addresses a ON a.address_id = b.address_id
        WHERE b.branch_id = $1 AND b.is_active
        FOR UPDATE OF b, a`,
      [req.params.id],
    );
    const current = rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: { message: `Branch ${req.params.id} not found` },
      });
    }

    const valueFor = (field) => text[field] === undefined ? current[field] : text[field];
    if (addressUpdateProvided) {
      await client.query(
        `UPDATE addresses
            SET province = $2, city_municipality = $3, barangay = $4,
                street_address = $5, postal_code = $6, latitude = $7, longitude = $8
          WHERE address_id = $1`,
        [
          current.address_id,
          valueFor("province"),
          valueFor("city_municipality"),
          valueFor("barangay"),
          valueFor("street_address"),
          valueFor("postal_code"),
          coords ? coords.latitude : current.latitude,
          coords ? coords.longitude : current.longitude,
        ],
      );
    }
    if (branchUpdateProvided) {
      await client.query(
        `UPDATE branches
            SET branch_name = $2, contact_number = $3, is_available = $4
          WHERE branch_id = $1`,
        [
          current.branch_id,
          valueFor("branch_name"),
          valueFor("contact_number"),
          hasOwn(body, "is_available") ? body.is_available : current.is_available,
        ],
      );
    }

    const updated = await selectBranch(client, current.branch_id);
    await client.query("COMMIT");
    res.json(updated);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(e));
  } finally {
    client.release();
  }
});

// Couriers are minted only via POST /api/admin/users (kind=courier), which
// creates the linked login. Here coordinators/admins edit an existing courier's
// logistics fields. full_name is not editable -- it mirrors the user account.
// Partial: omitted keys are left unchanged; an explicit assigned_branch_id:null
// unassigns (COALESCE cannot write null, so the branch column uses a presence
// flag + CASE WHEN).
router.patch("/couriers/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  try {
    const { phone_number, vehicle_type, assigned_branch_id } = req.body ?? {};
    const branchProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "assigned_branch_id");

    if (branchProvided && assigned_branch_id != null) {
      const active = await query(
        "SELECT 1 FROM branches WHERE branch_id = $1 AND is_active",
        [assigned_branch_id],
      );
      if (!active.rowCount) {
        return res.status(400).json({
          error: { message: "assigned_branch_id must reference an active branch" },
        });
      }
    }

    const { rows } = await query(
      `UPDATE couriers SET
         phone_number = COALESCE($2, phone_number),
         vehicle_type = COALESCE($3, vehicle_type),
         assigned_branch_id = CASE WHEN $4 THEN $5 ELSE assigned_branch_id END
       WHERE courier_id = $1 AND is_active
       RETURNING courier_id, full_name, phone_number, vehicle_type, assigned_branch_id`,
      [req.params.id, phone_number ?? null, vehicle_type ?? null, branchProvided, assigned_branch_id ?? null],
    );
    if (!rows.length) {
      return res.status(404).json({ error: { message: `Courier ${req.params.id} not found` } });
    }
    res.json(rows[0]);
  } catch(e) {
    next(asClientError(e));
  }
});

// Soft delete: hide from management lists but keep parcel history intact
// (tracking_logs still reference the row). Deleting a branch also unassigns
// its couriers so the courier list does not point at a hidden branch.
router.delete("/branches/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    // A branch cannot be deactivated while its unassigned pickup pool is
    // holding live parcels -- those parcels would resolve to no courier's
    // scope (courierBranchId no longer matches an active branch) and become
    // effectively stranded.
    const stranded = await client.query(
      `
      SELECT COUNT(*) AS count
        FROM parcels p
        ${LATEST_LOG}
       WHERE latest.branch_id = $1
         AND latest.courier_id IS NULL
         AND latest.status_update <> ALL($2::text[])`,
      [req.params.id, [...TERMINAL_TRACKING_STATUSES]],
    );
    const strandedCount = Number(stranded.rows[0].count);
    if (strandedCount > 0) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(409).json({
        error: {
          message: `Cannot deactivate branch: ${strandedCount} live parcel(s) in its unassigned pool; reassign them first`,
        },
      });
    }

    const { rowCount } = await client.query(
      "UPDATE branches SET is_active = false WHERE branch_id = $1 AND is_active",
      [req.params.id]
    );
    if (!rowCount) {
      await client.query("ROLLBACK").catch(() => {});
      return res.status(404).json({ error: { message: `Branch ${req.params.id} not found` } });
    }
    await client.query(
      "UPDATE couriers SET assigned_branch_id = NULL WHERE assigned_branch_id = $1",
      [req.params.id]
    );
    await client.query("COMMIT");
    res.status(204).end();
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    next(asClientError(e));
  } finally {
    client.release();
  }
});

router.delete("/couriers/:id", requireAnyRole(["logistics_coordinator", "platform_admin"]), async (req, res, next) => {
  try {
    const { rowCount } = await query(
      "UPDATE couriers SET is_active = false WHERE courier_id = $1 AND is_active",
      [req.params.id]
    );
    if (!rowCount) {
      return res.status(404).json({ error: { message: `Courier ${req.params.id} not found` } });
    }
    res.status(204).end();
  } catch (e) {
    next(asClientError(e));
  }
});

export default router;
