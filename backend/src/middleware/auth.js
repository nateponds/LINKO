import { getSessionUser } from "../auth/sessions.js";
import { activeMemberships, isPlatformAdmin } from "./ownership.js";

function parseCookies(header = "") {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function requireAuth(req, _res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const session = await getSessionUser(cookies.linko_session);

    if (!session) {
      return next(createHttpError(401, "Authentication required"));
    }

    req.auth = session;
    return next();
  } catch (error) {
    return next(error);
  }
}

// RBAC policy (mirrored client-side in src/auth/roleAccess.js):
//   - Business roles count only for the ACTIVE business (X-Active-Business, or
//     the caller's single business). Roles on other businesses grant nothing.
//   - platform_admin passes ONLY where `roles` names it. No implicit bypass:
//     admin reach is an explicit, per-route decision.
export const MARKETPLACE_ROLES = ["buyer", "wholesaler"];

export function requireAnyRole(roles) {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(createHttpError(401, "Authentication required"));
    }

    if (isPlatformAdmin(req.auth.user) && roles.includes("platform_admin")) {
      return next();
    }

    try {
      const activeRoles = activeMemberships(req).map((m) => m.role);
      if (!activeRoles.some((role) => roles.includes(role))) {
        return next(createHttpError(403, "Forbidden"));
      }
    } catch (error) {
      return next(error);
    }

    return next();
  };
}

export function requireGlobalRole(role) {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(createHttpError(401, "Authentication required"));
    }

    if (req.auth.user.global_role !== role) {
      return next(createHttpError(403, "Forbidden"));
    }

    return next();
  };
}
