/* Shared display formatters for the logistics pages. */

export const statusClass = (status) =>
  (status || "unknown").toLowerCase().replace(/\s+/g, "-");

export const peso = (n) =>
  n == null ? "—" : `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })
    : "—";

export function stockBadge(status) {
  if (status === "out_of_stock") return { label: "Out of Stock", cls: "out-of-stock" };
  if (status === "low_stock") return { label: "Low on Stock", cls: "low-on-stock" };
  return { label: "In Stock", cls: "in-stock" };
}
