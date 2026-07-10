// Milestone 5: business-context resolution, row-level ownership helpers, and
// tiny input-validation primitives shared across routes.
//
// Active business context travels in the `X-Active-Business` request header,
// sent by the frontend and always validated server-side against the caller's
// memberships (never trusted blindly). There is no session-table column for it.

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isPlatformAdmin(user) {
  return user?.global_role === "platform_admin";
}

// Reads and validates the X-Active-Business header for the current request.
// Returns the numeric business_id when present and valid, or null when absent.
// Throws 403 when the header names a business the caller is not a member of.
function readActiveBusinessHeader(req) {
  const raw = req.headers["x-active-business"];
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const businessId = Number(raw);
  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw createHttpError(400, "X-Active-Business must be a positive integer business id");
  }
  const isMember = req.auth.memberships.some((m) => m.business_id === businessId);
  if (!isMember) {
    throw createHttpError(403, "Not a member of the selected business");
  }
  return businessId;
}

// Resolves the business the caller is acting as for this request.
//   - If X-Active-Business is present, it must match one of the caller's
//     memberships (optionally constrained to `roles`); otherwise 403.
//   - If absent, falls back to the caller's single membership matching `roles`
//     (or their first membership when `roles` is omitted).
//   - If the caller has multiple matching memberships and no header, throws 400
//     asking the client to select a business.
//   - Throws 403 when the caller has no matching membership.
// `roles` is an optional array of acceptable membership roles.
export function getActiveMembership(req, roles) {
  const memberships = req.auth.memberships;
  const matches = Array.isArray(roles) && roles.length
    ? memberships.filter((m) => roles.includes(m.role))
    : memberships;

  const headerBusinessId = readActiveBusinessHeader(req);
  if (headerBusinessId !== null) {
    const membership = matches.find((m) => m.business_id === headerBusinessId);
    if (!membership) {
      // Header named a business the caller belongs to, but not in an
      // acceptable role for this action.
      throw createHttpError(403, "Not a member of the selected business");
    }
    return membership;
  }

  // Gate on distinct businesses, not membership rows: a single business with
  // several roles (e.g. a buyer+wholesaler `both`) resolves automatically. Only
  // a genuinely ambiguous multi-business caller with no header gets 400.
  const distinctBusinessIds = new Set(matches.map((m) => m.business_id));
  if (distinctBusinessIds.size === 1) {
    return matches[0];
  }
  if (distinctBusinessIds.size > 1) {
    throw createHttpError(400, "Multiple businesses available; select one via X-Active-Business");
  }

  const label = Array.isArray(roles) && roles.length ? roles.join(" or ") : "";
  throw createHttpError(
    403,
    label ? `You must belong to a ${label} business` : "You must belong to a business",
  );
}

// Resolves the id of the business the caller is acting as, independent of role.
//   - X-Active-Business header if present (validated against memberships).
//   - Else the caller's single distinct business.
//   - Else (multiple distinct businesses, no header) throws 400.
// Returns null only when the caller has no memberships at all.
export function resolveActiveBusinessId(req) {
  const headerBusinessId = readActiveBusinessHeader(req);
  if (headerBusinessId !== null) {
    return headerBusinessId;
  }
  const distinctBusinessIds = new Set(
    req.auth.memberships.map((m) => m.business_id),
  );
  if (distinctBusinessIds.size === 1) {
    return [...distinctBusinessIds][0];
  }
  if (distinctBusinessIds.size > 1) {
    throw createHttpError(400, "Multiple businesses available; select one via X-Active-Business");
  }
  return null;
}

// True when the caller is a platform admin or a member of `businessId`.
// Throws 403 otherwise.
export function assertBusinessAccess(req, businessId) {
  if (isPlatformAdmin(req.auth.user)) {
    return true;
  }
  const owns = req.auth.memberships.some((m) => m.business_id === businessId);
  if (!owns) {
    throw createHttpError(403, "You do not have access to this business");
  }
  return true;
}

// The business ids the caller is a member of (any role), for `= ANY($ids)`
// scoping in the dashboard.js house style.
export function memberBusinessIds(req) {
  return req.auth.memberships.map((m) => m.business_id);
}

// ---------------------------------------------------------------------------
// Tiny input-validation primitives -- no validation library, per house style.
// All throw a 400 createHttpError so routes can rely on the shared error shape.
// ---------------------------------------------------------------------------

// Throws 400 when any of `fields` (an object) has a null/undefined/empty value.
export function requireFields(body, fields) {
  const source = body ?? {};
  const missing = fields.filter((key) => {
    const value = source[key];
    return value === undefined || value === null || value === "";
  });
  if (missing.length) {
    throw createHttpError(400, `Missing required fields: ${missing.join(", ")}`);
  }
}

// Returns a positive integer or throws 400 with `label`.
export function requirePositiveInt(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, `${label} must be a positive integer`);
  }
  return id;
}

// Basic email shape check; returns the trimmed, lower-cased email or throws 400.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function requireEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    throw createHttpError(400, "A valid email address is required");
  }
  return email;
}
