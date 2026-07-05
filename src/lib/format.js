/* Shared display formatters for the logistics pages. */

export const statusClass = (status) =>
  (status || "unknown").toLowerCase().replace(/\s+/g, "-");

export const peso = (n) =>
  n == null ? "—" : `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" })
    : "—";
