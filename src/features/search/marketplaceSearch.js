export const RECENT_SEARCH_KEY = "linko-recent-searches";
export const RECENT_SEARCH_LIMIT = 8;
export const SUGGESTION_GROUP_LIMIT = 4;

const SEARCH_PAGINATION_KEYS = [
  "page",
  "limit",
  "product_page",
  "product_limit",
  "product_q",
  "supplier_page",
  "supplier_limit",
  "supplier_q",
];

export function normalizeSearchQuery(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function marketplaceSearchPath({ q = "", category = "" } = {}) {
  const params = new URLSearchParams();
  const query = normalizeSearchQuery(q);
  const categoryName = String(category ?? "").trim();
  if (query) params.set("q", query);
  if (categoryName) params.set("category", categoryName);
  const text = params.toString();
  return text ? `/?${text}` : "/";
}

export function searchParamsWithoutQuery(search) {
  const params = new URLSearchParams(typeof search === "string" ? search.replace(/^\?/, "") : search);
  params.delete("q");
  for (const key of SEARCH_PAGINATION_KEYS) params.delete(key);
  return params;
}

function suggestionLabels(item, fields) {
  return fields.map((field) => String(item?.[field] ?? ""));
}

// Lower is a closer match. Exact name/sku beats a prefix, then a word, then
// a substring. Items the query does not appear in stay in their original order.
export function suggestionRank(item, query, fields) {
  const needle = normalizeSearchQuery(query).toLowerCase();
  if (!needle) return 4;
  let best = 4;
  for (const label of suggestionLabels(item, fields)) {
    const text = label.toLowerCase();
    if (!text) continue;
    if (text === needle) best = Math.min(best, 0);
    else if (text.startsWith(needle)) best = Math.min(best, 1);
    else if (text.split(/[^a-z0-9]+/i).some((word) => word.startsWith(needle))) best = Math.min(best, 2);
    else if (text.includes(needle)) best = Math.min(best, 3);
  }
  return best;
}

export function rankSuggestions(items, query, { fields, limit = SUGGESTION_GROUP_LIMIT } = {}) {
  const needle = normalizeSearchQuery(query);
  if (!needle || !Array.isArray(items) || !Array.isArray(fields) || fields.length === 0) return [];
  const cap = Number.isInteger(limit) && limit > 0 ? limit : SUGGESTION_GROUP_LIMIT;
  return items
    .map((item, index) => ({ item, index, rank: suggestionRank(item, needle, fields) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, cap)
    .map((entry) => entry.item);
}

export function parseRecentSearches(raw, limit = RECENT_SEARCH_LIMIT) {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const cap = Number.isInteger(limit) && limit > 0 ? limit : RECENT_SEARCH_LIMIT;
  const seen = new Set();
  const searches = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const query = normalizeSearchQuery(item);
    if (!query) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    searches.push(query);
    if (searches.length >= cap) break;
  }
  return searches;
}

export function rememberSearch(list, query, limit = RECENT_SEARCH_LIMIT) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : RECENT_SEARCH_LIMIT;
  const next = normalizeSearchQuery(query);
  const current = parseRecentSearches(list, Number.MAX_SAFE_INTEGER);
  if (!next) return current.slice(0, cap);
  const rest = current.filter((item) => item.toLowerCase() !== next.toLowerCase());
  return [next, ...rest].slice(0, cap);
}

export function loadRecentSearches(storage, limit = RECENT_SEARCH_LIMIT) {
  if (!storage || typeof storage.getItem !== "function") return [];
  try {
    return parseRecentSearches(storage.getItem(RECENT_SEARCH_KEY), limit);
  } catch {
    return [];
  }
}

export function saveRecentSearches(list, storage) {
  if (!storage || typeof storage.setItem !== "function") return;
  try {
    storage.setItem(RECENT_SEARCH_KEY, JSON.stringify(parseRecentSearches(list)));
  } catch {
    // Private mode and quota errors should not block a search.
  }
}

export function clearRecentSearches(storage) {
  if (!storage || typeof storage.removeItem !== "function") return;
  try {
    storage.removeItem(RECENT_SEARCH_KEY);
  } catch {
    // Ignore storage failures; the in-memory list is cleared by the caller.
  }
}
