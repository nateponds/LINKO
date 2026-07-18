export const TRACKING_STATUSES = [
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

export const RETURN_TRIGGER_FAILS = 3;

// One tap = status + fixed remark (handoff 2026-07-16 §5). Delivered/Returned
// and the branch checkpoints (Arrived/Departed) send nothing — the backend
// auto-generates proof of delivery and branch-name remarks from accounts.
export const ONE_TAP_REMARKS = {
  "Picked Up": "Picked up by courier",
  "Out for Delivery": "Out for delivery",
  "Out for Return": "Out for return to sender",
};

export const FAIL_REASONS = ["Receiver unavailable", "Delivery refused", "Bad address"];

// Hard reasons skip the retry loop and open the return leg immediately;
// everything else is a soft fail that gets another delivery attempt.
export const HARD_FAIL_REASONS = ["Bad address", "Delivery refused"];

const TERMINAL_STATUSES = new Set(["Delivered", "Returned", "Cancelled"]);

// ponytail: this transition map is the single source of truth for courier
// actions — dashboard buttons and detail-page options both derive from it,
// no hardcoded status lists in the UI. Mirrors backend routes/logistics.js.
const COURIER_TRANSITIONS = {
  "Order Created": ["Picked Up"],
  "Picked Up": ["Arrived at Branch", "Out for Delivery"],
  // Arrived can depart for another hub or go straight out for delivery at the
  // final hub -- no redundant Departed Branch before Out for Delivery.
  // Return-triggered return-leg edges are injected in allowedNext.
  "Arrived at Branch": ["Departed Branch", "Out for Delivery"],
  // Departed is never terminal -- no 'Returned' edge off it.
  "Departed Branch": ["Arrived at Branch", "Out for Delivery"],
  "Out for Delivery": ["Delivered", "Delivery Failed"],
};

export function allowedNext(currentStatus, returnTriggered = false) {
  if (!currentStatus || !TRACKING_STATUSES.includes(currentStatus)) {
    return TRACKING_STATUSES.filter((status) => status !== "Cancelled");
  }
  if (TERMINAL_STATUSES.has(currentStatus)) return [];
  if (currentStatus === "Delivery Failed") {
    return returnTriggered ? ["Arrived at Branch"] : ["Out for Delivery"];
  }
  // Return-triggered return leg: branch arrival -> Out for Return -> Returned.
  if (currentStatus === "Arrived at Branch" && returnTriggered) {
    // Return leg is one-way: leave the return branch for the sender next.
    return ["Out for Return"];
  }
  if (currentStatus === "Out for Return") {
    return returnTriggered ? ["Returned"] : [];
  }
  return COURIER_TRANSITIONS[currentStatus] ?? [];
}

export function selectableTrackingStatuses(currentStatus, canUpdateAssignment, returnTriggered = false) {
  const next = allowedNext(currentStatus, returnTriggered);
  // Coordinators/admins follow the same checkpoint map as couriers; their only
  // extra move is 'Cancelled' (terminal escape hatch), and never off a terminal.
  if (canUpdateAssignment && currentStatus && !TERMINAL_STATUSES.has(currentStatus)) {
    return [...next, "Cancelled"];
  }
  return next;
}

// Return-leg cue: a parcel is on its way back to the sender once the return
// leg is triggered and it has not yet reached a terminal scan.
export function isReturning(currentStatus, returnTriggered) {
  return returnTriggered && !TERMINAL_STATUSES.has(currentStatus);
}

export function countFailedAttempts(trackingHistory) {
  return (trackingHistory ?? []).filter(
    (entry) => entry.status_update === "Delivery Failed",
  ).length;
}

// Return leg opens when either the retry cap is hit or any hard-fail reason is
// logged. Mirrors the backend's return_triggered on the parcels list payload.
export function returnTriggeredFromHistory(trackingHistory) {
  const fails = (trackingHistory ?? []).filter((e) => e.status_update === "Delivery Failed");
  return fails.length >= RETURN_TRIGGER_FAILS ||
         fails.some((e) => HARD_FAIL_REASONS.includes(e.remarks));
}
