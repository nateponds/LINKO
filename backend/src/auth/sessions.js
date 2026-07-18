import { createHash, randomBytes } from "node:crypto";
import { getPool } from "../db.js";

const COOKIE_NAME = "linko_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSessionPayload(row) {
  return {
    user: {
      user_id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      global_role: row.global_role,
    },
    memberships: row.memberships ?? [],
  };
}

export async function createSession(userId, db = getPool()) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);

  await db.query(
    `INSERT INTO auth_sessions (session_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second'))`,
    [randomBytes(16).toString("hex"), userId, tokenHash, SESSION_TTL_SECONDS],
  );

  return token;
}

export async function getSessionUser(sessionToken, db = getPool()) {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const result = await db.query(
    `SELECT
       u.user_id,
       u.email,
       u.full_name,
       u.global_role,
       COALESCE(
         json_agg(
           json_build_object(
             'business_id', b.business_id,
             'business_name', b.business_name,
             'business_type', b.business_type,
             'role', bm.role,
             'has_coordinates', (ba.latitude IS NOT NULL AND ba.longitude IS NOT NULL)
           )
           ORDER BY b.business_id, bm.role
         ) FILTER (WHERE bm.membership_id IS NOT NULL),
         '[]'::json
       ) AS memberships
     FROM auth_sessions s
     JOIN users u ON u.user_id = s.user_id
     LEFT JOIN business_memberships bm ON bm.user_id = u.user_id
     LEFT JOIN businesses b ON b.business_id = bm.business_id
     LEFT JOIN addresses ba ON ba.address_id = b.logistics_address_id
     WHERE s.token_hash = $1
       AND s.expires_at > CURRENT_TIMESTAMP
       AND u.is_active
     GROUP BY u.user_id, u.email, u.full_name, u.global_role`,
    [tokenHash],
  );

  if (result.rowCount === 0) {
    await db.query(
      "DELETE FROM auth_sessions WHERE token_hash = $1 AND expires_at <= CURRENT_TIMESTAMP",
      [tokenHash],
    );
    return null;
  }

  return buildSessionPayload(result.rows[0]);
}

export async function destroySession(sessionToken, db = getPool()) {
  if (!sessionToken) {
    return;
  }

  await db.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashSessionToken(sessionToken)]);
}

export function serializeSessionCookie(token) {
  const attributes = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function clearSessionCookie() {
  const attributes = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}
