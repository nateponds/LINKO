export const TRACKING_STATUSES = [
  "Order Created",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Returned",
  "Cancelled",
];

const STATUS_RANK = {
  "Order Created": 0,
  "Picked Up": 1,
  "In Transit": 2,
  "Out for Delivery": 3,
  Delivered: 4,
  Returned: 4,
  Cancelled: 4,
};

const TERMINAL_STATUSES = new Set(["Delivered", "Returned", "Cancelled"]);

export function selectableTrackingStatuses(currentStatus, canUpdateAssignment) {
  if (canUpdateAssignment || !currentStatus || STATUS_RANK[currentStatus] == null) {
    return TRACKING_STATUSES;
  }

  if (TERMINAL_STATUSES.has(currentStatus)) {
    return [currentStatus];
  }

  const currentRank = STATUS_RANK[currentStatus];
  return TRACKING_STATUSES.filter((status) => STATUS_RANK[status] >= currentRank);
}
