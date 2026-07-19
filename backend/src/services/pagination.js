const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const ALLOWED_LIMITS = new Set([10, 25, 50]);
const MAX_QUERY_LENGTH = 100;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function readSingletonString(query, name) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw badRequest(`${name} must be a single string`);
  }
  return value;
}

function parsePositiveBase10Integer(value, name) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw badRequest(`${name} must be a positive base-10 integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw badRequest(`${name} must be a positive base-10 integer`);
  }
  return parsed;
}

// Parses Express query values into safe pagination input for database queries.
// It deliberately accepts only singleton strings: repeated query keys arrive as
// arrays and must be rejected rather than silently choosing one value.
export function parsePaginationQuery(query) {
  const pageValue = readSingletonString(query, "page");
  const limitValue = readSingletonString(query, "limit");
  const qValue = readSingletonString(query, "q");

  const page = pageValue === undefined
    ? DEFAULT_PAGE
    : parsePositiveBase10Integer(pageValue, "page");
  const limit = limitValue === undefined
    ? DEFAULT_LIMIT
    : parsePositiveBase10Integer(limitValue, "limit");

  if (!ALLOWED_LIMITS.has(limit)) {
    throw badRequest("limit must be one of 10, 25, or 50");
  }

  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    throw badRequest("page is too large");
  }

  const pagination = { page, limit, offset };
  if (qValue !== undefined) {
    const q = qValue.trim();
    if (q.length > MAX_QUERY_LENGTH) {
      throw badRequest("q must be at most 100 characters");
    }
    if (q) pagination.q = q;
  }
  return pagination;
}

// Builds the common response shape once an endpoint has fetched its page of
// items and the matching row count. Out-of-range pages remain valid metadata.
export function buildPaginatedResponse(items, { page, limit }, totalItems) {
  return {
    items,
    pagination: {
      page,
      limit,
      total_items: totalItems,
      total_pages: Math.ceil(totalItems / limit),
    },
  };
}
