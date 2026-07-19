export const PAGE_LIMITS = [10, 25, 50];
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function toPositiveInteger(value) {
  if (typeof value === "number") return isPositiveInteger(value) ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return isPositiveInteger(parsed) ? parsed : null;
}

function toNonNegativeInteger(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function sanitizePage(value, fallback = DEFAULT_PAGE) {
  return toPositiveInteger(value) ?? fallback;
}

export function sanitizeLimit(value, fallback = DEFAULT_LIMIT) {
  const parsed = toPositiveInteger(value);
  return PAGE_LIMITS.includes(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function clampPage(page, totalPages) {
  const safeTotalPages = toNonNegativeInteger(totalPages) ?? 0;
  return safeTotalPages === 0 ? DEFAULT_PAGE : clamp(sanitizePage(page), 1, safeTotalPages);
}

export function paginationRange({ page, limit, total_items: totalItems, total_pages: totalPages } = {}) {
  const safeTotalItems = toNonNegativeInteger(totalItems) ?? 0;
  const safeLimit = sanitizeLimit(limit);
  const safeTotalPages = toNonNegativeInteger(totalPages) ?? Math.ceil(safeTotalItems / safeLimit);
  const safePage = clampPage(page, safeTotalPages);

  if (safeTotalItems === 0) {
    return { start: 0, end: 0, totalItems: 0, page: safePage, totalPages: 0, limit: safeLimit };
  }

  return {
    start: (safePage - 1) * safeLimit + 1,
    end: Math.min(safePage * safeLimit, safeTotalItems),
    totalItems: safeTotalItems,
    page: safePage,
    totalPages: safeTotalPages,
    limit: safeLimit,
  };
}

export function listParamKeys(prefix = "") {
  const normalizedPrefix = typeof prefix === "string" && prefix.trim() ? `${prefix.trim()}_` : "";
  return {
    page: `${normalizedPrefix}page`,
    limit: `${normalizedPrefix}limit`,
    q: `${normalizedPrefix}q`,
  };
}

function asSearchParams(search) {
  return new URLSearchParams(typeof search === "string" ? search.replace(/^\?/, "") : search);
}

export function readListUrlState(search, { prefix = "", defaultLimit = DEFAULT_LIMIT } = {}) {
  const params = asSearchParams(search);
  const keys = listParamKeys(prefix);
  return {
    page: sanitizePage(params.get(keys.page)),
    limit: sanitizeLimit(params.get(keys.limit), defaultLimit),
    q: params.get(keys.q) ?? "",
  };
}

// Updates only the list's namespaced keys (plus explicitly supplied filters),
// leaving links, tabs, and other lists' parameters intact.
export function updateListUrlState(
  search,
  changes,
  { prefix = "", defaultLimit = DEFAULT_LIMIT } = {},
) {
  const params = asSearchParams(search);
  const keys = listParamKeys(prefix);
  const hasOwn = (key) => Object.hasOwn(changes, key);
  const hasFilters = hasOwn("filters") && changes.filters && typeof changes.filters === "object";
  const resetPage = !hasOwn("page") && (hasOwn("q") || hasOwn("limit") || hasFilters);

  if (hasOwn("q")) {
    const query = String(changes.q ?? "").trim();
    if (query) params.set(keys.q, query);
    else params.delete(keys.q);
  }

  if (hasOwn("limit")) {
    params.set(keys.limit, String(sanitizeLimit(changes.limit, defaultLimit)));
  }

  if (hasFilters) {
    for (const [key, value] of Object.entries(changes.filters)) {
      if (value === undefined || value === null || value === "") params.delete(key);
      else params.set(key, String(value));
    }
  }

  if (hasOwn("page")) params.set(keys.page, String(sanitizePage(changes.page)));
  else if (resetPage) params.set(keys.page, String(DEFAULT_PAGE));

  return params;
}
