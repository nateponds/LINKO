import { query } from "../../db.js";
import {
  isPlatformAdmin,
  resolveActiveBusinessId,
} from "../../middleware/ownership.js";
import { TERMINAL_PARCEL_STATUSES } from "../../services/parcelRouting.js";
import { parsePaginationQuery } from "../../services/pagination.js";
import {
  createHttpError,
  asClientError,
  readSingletonQueryString,
} from "../../lib/httpErrors.js";
import { LATEST_PARCEL_LOG_SQL } from "../../services/trackingLogs.js";

export {
  createHttpError,
  asClientError,
  readSingletonQueryString,
  LATEST_PARCEL_LOG_SQL,
};

export const PARCEL_READ_ROLES = [
  "buyer",
  "wholesaler",
  "logistics_coordinator",
  "courier",
  "platform_admin",
];
export const SERVICE_TIER_READ_ROLES = [
  "buyer",
  "wholesaler",
  "logistics_coordinator",
  "courier",
  "platform_admin",
];
export const LOGISTICS_REFERENCE_READ_ROLES = [
  "wholesaler",
  "logistics_coordinator",
  "courier",
  "platform_admin",
];
export const LOGISTICS_OPS_ROLES = ["logistics_coordinator", "platform_admin"];
export const PARCEL_CREATE_ROLES = [
  "wholesaler",
  "logistics_coordinator",
  "platform_admin",
];
export const PARCEL_TRACKING_ROLES = [
  "logistics_coordinator",
  "courier",
  "platform_admin",
];
export const PLATFORM_ADMIN_ROLES = ["platform_admin"];

export const VALID_TRACKING_STATUSES = [
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
export const TERMINAL_TRACKING_STATUSES = new Set(TERMINAL_PARCEL_STATUSES);
export const TERMINAL_TRACKING_STATUS_LIST = [...TERMINAL_TRACKING_STATUSES];
// "Stuck" = any non-terminal in-flight status whose latest scan is older than
// STUCK_SCAN_DAYS. Mirrors the issue #79 vocabulary; the admin and logistics
// pages surface it as one flag and deep-link into the filtered list.
export const STUCK_TRACKING_STATUSES = [
  "Order Created",
  "Picked Up",
  "Arrived at Branch",
  "Departed Branch",
  "Out for Delivery",
  "Out for Return",
];
export const STUCK_SCAN_DAYS = 2;
export const PARCEL_ASSIGNMENTS = new Set(["available", "active", "completed"]);
export const RETURN_TRIGGER_FAILS = 3;

// Delivery failure reasons. A Delivery Failed scan must carry exactly one of
// these as its remark (enforced in POST /parcels/:id/tracking). Mirrors
// src/lib/statusWorkflow.js - keep both lists in sync.
export const FAIL_REASONS = [
  "Receiver unavailable",
  "Delivery refused",
  "Bad address",
];
// Hard reasons open the return leg immediately on the fail they occur, skipping
// the retry loop. Soft reasons (the remainder) get retries up to RETURN_TRIGGER_FAILS.
export const HARD_FAIL_REASONS = ["Bad address", "Delivery refused"];
export const isHardFailReason = (remarks) =>
  HARD_FAIL_REASONS.includes(
    typeof remarks === "string" ? remarks.trim() : remarks,
  );

export const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

// Filter parsing stays beside the logistics routes because status and
// assignment are domain concepts; shared page/q parsing lives in pagination.
export function parseParcelListQuery(queryParams) {
  const pagination = parsePaginationQuery(queryParams);
  const status = readSingletonQueryString(queryParams.status, "status");
  const assignment = readSingletonQueryString(queryParams.assignment, "assignment");
  const courierIdValue = readSingletonQueryString(queryParams.courier_id, "courier_id");
  const agingValue = readSingletonQueryString(queryParams.aging, "aging");
  const stuckValue = readSingletonQueryString(queryParams.stuck, "stuck");

  if (status !== undefined && !VALID_TRACKING_STATUSES.includes(status)) {
    throw createHttpError(400, "status must be a valid tracking status");
  }
  if (assignment !== undefined && !PARCEL_ASSIGNMENTS.has(assignment)) {
    throw createHttpError(
      400,
      "assignment must be one of available, active, or completed",
    );
  }
  let courierId;
  if (courierIdValue !== undefined) {
    courierId = Number(courierIdValue);
    if (
      !/^[1-9]\d*$/.test(courierIdValue) ||
      !Number.isSafeInteger(courierId) ||
      courierId > 2147483647
    ) {
      throw createHttpError(400, "courier_id must be a positive 32-bit integer");
    }
  }
  if (
    agingValue !== undefined &&
    agingValue !== "true" &&
    agingValue !== "false"
  ) {
    throw createHttpError(400, "aging must be true or false");
  }
  const aging = agingValue === "true";
  if (aging && status !== undefined && status !== "Order Created") {
    throw createHttpError(
      400,
      "aging=true can only be used with status=Order Created",
    );
  }
  if (
    stuckValue !== undefined &&
    stuckValue !== "true" &&
    stuckValue !== "false"
  ) {
    throw createHttpError(400, "stuck must be true or false");
  }
  const stuck = stuckValue === "true";
  // stuck already implies the six in-flight statuses; combining it with a
  // status or the aging filter would only confuse the contract.
  if (stuck && status !== undefined) {
    throw createHttpError(
      400,
      "stuck=true cannot be combined with a status filter",
    );
  }
  if (stuck && aging) {
    throw createHttpError(400, "stuck=true cannot be combined with aging=true");
  }

  const filters = { ...pagination, status, assignment };
  if (courierId !== undefined) filters.courierId = courierId;
  if (agingValue !== undefined) filters.aging = aging;
  if (stuckValue !== undefined) filters.stuck = stuck;
  return filters;
}

// The flow is non-linear (checkpoints repeat, delivery retries, the return leg
// retraces hubs "backwards"), so courier moves are an explicit transition map
// rather than an integer rank. The 'Delivery Failed' edge is count-aware:
// < 3 fails allows a retry, the 3rd fail opens the return leg - the count
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
// POST handler and the list query) - see isHardFailReason / RETURN_TRIGGER_FAILS.
export function courierAllowedNextStatuses(
  currentStatus,
  returnTriggered = false,
) {
  if (!currentStatus) return [];
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

export function canCourierSubmitTrackingStatus(
  currentStatus,
  nextStatus,
  returnTriggered = false,
) {
  if (!currentStatus) {
    return {
      allowed: false,
      message:
        "This parcel has no tracking status. Ask a logistics coordinator to review it.",
    };
  }
  if (nextStatus === "Cancelled") {
    return {
      allowed: false,
      message:
        "Couriers cannot cancel parcels; use Delivery Failed for failed delivery outcomes.",
    };
  }

  return canSubmitTrackingStatus(currentStatus, nextStatus, returnTriggered);
}

// The checkpoint transition map binds every role -- a coordinator/admin cannot
// skip 'Arrived at Branch'/'Departed Branch' either (handoff 2026-07-16 s2).
// The only privileged-exclusive move is 'Cancelled', a terminal escape hatch
// couriers are separately barred from (see canCourierSubmitTrackingStatus).
export function canSubmitTrackingStatus(
  currentStatus,
  nextStatus,
  returnTriggered = false,
) {
  if (nextStatus === "Cancelled") {
    return currentStatus && TERMINAL_TRACKING_STATUSES.has(currentStatus)
      ? {
          allowed: false,
          message: `Cannot update terminal parcel status ${currentStatus}`,
        }
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

export async function resolveActiveCourier(userId) {
  const { rows } = await query(
    "SELECT courier_id, assigned_branch_id FROM couriers WHERE user_id = $1 AND is_active",
    [userId],
  );
  return rows[0] ?? null;
}

// Row-level parcel visibility for the current caller:
//   { all: true }              -> logistics_coordinator or platform_admin
//   { businessIds: [...] }     -> wholesaler: parcels they send OR receive
//   { courierId, courierBranchId } -> courier: history plus branch pickup pool
//   receiverOnlyIds            -> buyer memberships: single-parcel reads where
//                                 they are the receiver; deliberately ignored
//                                 by the list so buyers never enumerate parcels
// Resolved once per request; used to build the WHERE clause in the house style.
export async function parcelScope(req) {
  const { user, memberships } = req.auth;
  if (isPlatformAdmin(user)) {
    return { all: true };
  }

  // Scope to the ACTIVE business only. A wholesaler/buyer/courier business that
  // is not the current selection grants no parcel-list rows. Throws 400 for a
  // multi-business caller with no X-Active-Business, which Express 5 forwards to
  // the central errorHandler.
  const activeBusinessId = resolveActiveBusinessId(req);
  const active = memberships.filter((m) => m.business_id === activeBusinessId);

  if (active.some((m) => m.role === "logistics_coordinator")) {
    return { all: true };
  }

  const receiverOnlyIds = active
    .filter((m) => m.role === "buyer")
    .map((m) => m.business_id);

  const businessIds = active
    .filter((m) => m.role === "wholesaler")
    .map((m) => m.business_id);
  if (businessIds.length) {
    return { businessIds, receiverOnlyIds };
  }

  // Only reach the courier pool when the active business is a courier business;
  // otherwise a buyer-active context would leak the courier's handling pool.
  // A buyer-only active business lists no parcels (it may still read a single
  // parcel it receives via receiverOnlyIds on the detail route).
  if (!active.some((m) => m.role === "courier")) {
    return { none: true, receiverOnlyIds };
  }

  const courier = await resolveActiveCourier(user.user_id);
  return {
    courierId: courier?.courier_id ?? null,
    courierBranchId: courier?.assigned_branch_id ?? null,
    receiverOnlyIds,
  };
}

export function parcelListBaseFilter(scope, filters) {
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
  if (filters.courierId !== undefined) {
    params.push(filters.courierId);
    clauses.push(`latest.courier_id = $${params.length}`);
  }
  if (filters.aging) {
    clauses.push(`latest.status_update = 'Order Created'
      AND latest.scanned_at < CURRENT_TIMESTAMP - make_interval(days => 2)`);
  }
  if (filters.stuck) {
    params.push(STUCK_TRACKING_STATUSES);
    const stuckStatusParam = params.length;
    params.push(STUCK_SCAN_DAYS);
    clauses.push(`latest.status_update = ANY($${stuckStatusParam}::text[])
      AND latest.scanned_at < CURRENT_TIMESTAMP - make_interval(days => $${params.length}::int)`);
  }
  return { params, clause: clauses.join(" AND ") };
}

export function assignmentClause(assignment, terminalParam) {
  const nonterminal = `(latest.status_update IS NULL
    OR latest.status_update <> ALL($${terminalParam}::text[]))`;
  if (assignment === "available")
    return `latest.courier_id IS NULL AND ${nonterminal}`;
  if (assignment === "active")
    return `latest.courier_id IS NOT NULL AND ${nonterminal}`;
  if (assignment === "completed")
    return `latest.status_update = ANY($${terminalParam}::text[])`;
  return null;
}

// Same rule as the detail view: only the sender/receiver see the shipping fee.
export function redactParcelListShippingFee(rows, scope) {
  const listPartyIds = [
    ...(scope.businessIds ?? []),
    ...(scope.receiverOnlyIds ?? []),
  ];
  for (const row of rows) {
    if (
      !listPartyIds.includes(row.sender.business_id) &&
      !listPartyIds.includes(row.receiver.business_id)
    ) {
      delete row.shipping_fee;
    }
  }
}

// Buyer visibility cutoff (AGENT_HANDOFF §9.3): a caller who sees this parcel
// ONLY as its receiver (buyer-side) must not see the return leg. Once the
// return leg is triggered, truncate their tracking_history at and including
// the fail that triggered it -- everything after is the internal
// LINKO<->wholesaler return journey. The trigger is the 3rd 'Delivery Failed'
// (soft-retry cap) OR the first fail carrying a hard reason, whichever comes
// first. All other callers (sender/wholesaler, courier, coordinator, admin)
// get the full history.
export function truncateBuyerReturnTracking(parcel, scope) {
  const isReceiverOnlyView =
    !scope.all &&
    !(scope.businessIds && scope.businessIds.includes(parcel.sender_id)) &&
    scope.courierId === undefined &&
    (scope.receiverOnlyIds?.includes(parcel.receiver_id) ?? false);
  if (!isReceiverOnlyView || !Array.isArray(parcel.tracking_history)) {
    return;
  }

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
    parcel.current_status = parcel.tracking_history[cutoffIndex].status_update;
    parcel.latest_courier_id = null;
    parcel.latest_branch_id = null;
    parcel.tracking_history = parcel.tracking_history.slice(0, cutoffIndex + 1);
  }
}

// Confidentiality: the declared value hints at the parcel's contents, so only
// the sender or receiver business sees it. Coordinators, couriers, and admins
// keep everything delivery needs (weight, addresses, route, payment).
export function redactParcelDetailConfidentialFields(parcel, scope) {
  const partyIds = [
    ...(scope.businessIds ?? []),
    ...(scope.receiverOnlyIds ?? []),
  ];
  if (
    !partyIds.includes(parcel.sender_id) &&
    !partyIds.includes(parcel.receiver_id)
  ) {
    delete parcel.declared_value;
    // Operators only need the cash to collect, not how it breaks down
    // (goods + shipping would give the declared value back).
    delete parcel.shipping_fee;
    const pay = parcel.payment;
    parcel.payment = {
      payment_status: pay?.payment_status ?? null,
      amount_to_collect: pay?.method === "COD" ? pay.amount : 0,
    };
  }

  // Strip the internal-only fields used for the ownership check.
  delete parcel.sender_id;
  delete parcel.receiver_id;
}
