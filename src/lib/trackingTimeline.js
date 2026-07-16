function formatAddress(address) {
  if (!address) return "";

  return [
    address.street_address,
    address.barangay,
    address.city_municipality,
    address.province,
  ]
    .filter(Boolean)
    .join(", ");
}

export function trackingLocationText(step, parcel) {
  // Delivery attempts (successful or failed) happen at the destination, not a
  // branch — showing a "handled by" branch there would mislead.
  if (step.status_update === "Out for Delivery" || step.status_update === "Delivery Failed") {
    return "";
  }

  if (step.status_update === "Delivered") {
    const destination = formatAddress(parcel?.destination_address);
    return destination ? `delivered to ${destination}` : "delivered to destination";
  }

  if (step.branch_name) {
    return `handled by ${step.branch_name}`;
  }

  return "branch not recorded";
}
