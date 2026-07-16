export const TRACKING_STATUSES = [
  "Order Created",
  "Picked Up",
  "Arrived at Branch",
  "Departed Branch",
  "Out for Delivery",
  "Delivery Failed",
  "Delivered",
  "Returned",
  "Cancelled",
];

export const RETURN_TRIGGER_FAILS = 3;

// One tap = status + fixed remark (handoff 2026-07-16 §5). Delivered/Returned
// send nothing — the backend auto-generates the proof of delivery from accounts.
export const ONE_TAP_REMARKS = {
  "Picked Up": "Picked up by courier",
  "Arrived at Branch": "Arrived at branch checkpoint",
  "Departed Branch": "Departed branch for next transit",
  "Out for Delivery": "Out for delivery",
};

export const FAIL_REASONS = ["Nobody home", "Delivery refused", "Bad address"];

const TERMINAL_STATUSES = new Set(["Delivered", "Returned", "Cancelled"]);

// ponytail: this transition map is the single source of truth for courier
// actions — dashboard buttons and detail-page options both derive from it,
// no hardcoded status lists in the UI. Mirrors backend routes/logistics.js.
const COURIER_TRANSITIONS = {
  "Order Created": ["Picked Up"],
  "Picked Up": ["Arrived at Branch", "Out for Delivery"],
  // Arrived can depart for another hub or go straight out for delivery at the
  // final hub -- no redundant Departed Branch before Out for Delivery. The
  // count-gated 'Returned' edge (Arrived -> Returned, fails>=3) is injected in
  // allowedNext, not here (mirrors backend logistics.js).
  "Arrived at Branch": ["Departed Branch", "Out for Delivery"],
  // Departed is never terminal -- no 'Returned' edge off it.
  "Departed Branch": ["Arrived at Branch", "Out for Delivery"],
  "Out for Delivery": ["Delivered", "Delivery Failed"],
};

export function allowedNext(currentStatus, failedAttempts = 0) {
  if (!currentStatus || !TRACKING_STATUSES.includes(currentStatus)) {
    return TRACKING_STATUSES.filter((status) => status !== "Cancelled");
  }
  if (TERMINAL_STATUSES.has(currentStatus)) return [];
  if (currentStatus === "Delivery Failed") {
    return failedAttempts >= RETURN_TRIGGER_FAILS
      ? ["Arrived at Branch"]
      : ["Out for Delivery"];
  }
  // Return leg: 'Returned' is only reachable from a branch arrival at fails>=3.
  // Injected here (not in COURIER_TRANSITIONS) because it is count-gated.
  if (currentStatus === "Arrived at Branch" && failedAttempts >= RETURN_TRIGGER_FAILS) {
    return [...COURIER_TRANSITIONS["Arrived at Branch"], "Returned"];
  }
  return COURIER_TRANSITIONS[currentStatus] ?? [];
}

export function selectableTrackingStatuses(currentStatus, canUpdateAssignment, failedAttempts = 0) {
  const next = allowedNext(currentStatus, failedAttempts);
  // Coordinators/admins follow the same checkpoint map as couriers; their only
  // extra move is 'Cancelled' (terminal escape hatch), and never off a terminal.
  if (canUpdateAssignment && currentStatus && !TERMINAL_STATUSES.has(currentStatus)) {
    return [...next, "Cancelled"];
  }
  return next;
}

// Return-leg cue: a parcel is on its way back to the sender once the 3rd
// Delivery Failed is logged and it has not yet reached a terminal scan.
export function isReturning(currentStatus, failedAttempts) {
  return (
    failedAttempts >= RETURN_TRIGGER_FAILS && !TERMINAL_STATUSES.has(currentStatus)
  );
}

export function countFailedAttempts(trackingHistory) {
  return (trackingHistory ?? []).filter(
    (entry) => entry.status_update === "Delivery Failed",
  ).length;
}
