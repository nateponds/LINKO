import { getSessionUser } from "../auth/sessions.js";

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

export function requireAnyRole(roles) {
  return (req, _res, next) => {
    if (!req.auth) {
      return next(createHttpError(401, "Authentication required"));
    }

    if (req.auth.user.global_role === "platform_admin") {
      return next();
    }

    const hasRole = req.auth.memberships.some((membership) => roles.includes(membership.role));
    if (!hasRole) {
      return next(createHttpError(403, "Forbidden"));
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
