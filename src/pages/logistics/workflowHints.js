import { allowedNext, selectableTrackingStatuses } from "../../lib/statusWorkflow.js";

export function nextStatusesForRole(currentStatus, returnTriggered, canUpdateAssignment) {
  return canUpdateAssignment
    ? selectableTrackingStatuses(currentStatus, true, returnTriggered)
    : allowedNext(currentStatus, Boolean(returnTriggered));
}

export function formatNextStatuses(statuses) {
  if (!statuses?.length) return "Finished — no further status";
  if (statuses.length === 1) return statuses[0];
  return `${statuses.slice(0, -1).join(", ")} or ${statuses[statuses.length - 1]}`;
}

export function courierActionCue(currentStatus, returnTriggered) {
  const next = allowedNext(currentStatus, Boolean(returnTriggered));
  if (next.length === 0) {
    return "This parcel is finished. No further status updates.";
  }
  if (returnTriggered && currentStatus === "Delivery Failed") {
    return "Next: take this parcel to the branch. The return leg is open.";
  }
  if (returnTriggered && currentStatus === "Arrived at Branch") {
    return "Next: leave the branch and head back to the sender.";
  }
  if (currentStatus === "Out for Return") {
    return "Next: hand this parcel back to the sender.";
  }
  return `Next: ${formatNextStatuses(next)}.`;
}

export const COURIER_EMPTY_COPY = {
  available: "No parcels are waiting at your branch. Open My active parcels for ones already assigned to you.",
  active: "No parcels are in progress. Open Available at my branch to pick one up.",
  completed: "No completed parcels yet. Delivered, returned, and cancelled parcels show up here.",
};
