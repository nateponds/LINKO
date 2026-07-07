import { Router } from "express";
import { hashPassword, verifyPassword } from "../auth/passwords.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  serializeSessionCookie,
} from "../auth/sessions.js";
import { getPool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const REGISTRATION_BUSINESS_TYPES = new Set(["buyer", "wholesaler"]);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function deriveLegacyRole(businessType) {
  return businessType === "wholesaler" ? "wholesaler" : "staff";
}

function deriveUsername(email) {
  return email.slice(0, 50);
}

router.post("/register", async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
  const businessName =
    typeof req.body?.business_name === "string" ? req.body.business_name.trim() : "";
  const businessType = typeof req.body?.business_type === "string" ? req.body.business_type.trim() : "";

  if (!email || !password || !fullName || !businessName || !businessType) {
    return next(createHttpError(400, "Missing required fields"));
  }

  if (password.length < 8) {
    return next(createHttpError(400, "Password must be at least 8 characters long"));
  }

  if (!REGISTRATION_BUSINESS_TYPES.has(businessType)) {
    return next(createHttpError(400, "business_type must be buyer or wholesaler"));
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existingUser.rowCount > 0) {
      throw createHttpError(409, "Email already registered");
    }

    const passwordHash = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (username, email, full_name, password_hash, role, global_role)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING user_id, email, full_name, global_role`,
      [deriveUsername(email), email, fullName, passwordHash, deriveLegacyRole(businessType)],
    );

    const businessResult = await client.query(
      `INSERT INTO businesses (business_name, business_type)
       VALUES ($1, $2)
       RETURNING business_id, business_name, business_type`,
      [businessName, businessType],
    );

    await client.query(
      `INSERT INTO addresses (business_id, province, city_municipality, barangay, street_address, postal_code)
       VALUES ($1, 'Not provided', 'Not provided', 'Not provided', 'Not provided', '0000')`,
      [businessResult.rows[0].business_id],
    );

    await client.query(
      "INSERT INTO user_businesses (user_id, business_id) VALUES ($1, $2)",
      [userResult.rows[0].user_id, businessResult.rows[0].business_id],
    );

    await client.query(
      "INSERT INTO business_memberships (user_id, business_id, role) VALUES ($1, $2, $3)",
      [userResult.rows[0].user_id, businessResult.rows[0].business_id, businessType],
    );

    const token = await createSession(userResult.rows[0].user_id, client);
    await client.query("COMMIT");

    res.setHeader("Set-Cookie", serializeSessionCookie(token));
    return res.status(201).json({
      user: userResult.rows[0],
      memberships: [
        {
          business_id: businessResult.rows[0].business_id,
          business_name: businessResult.rows[0].business_name,
          business_type: businessResult.rows[0].business_type,
          role: businessType,
        },
      ],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return next(error);
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || !password) {
    return next(createHttpError(400, "Missing required fields"));
  }

  try {
    const result = await getPool().query(
      "SELECT user_id, password_hash, is_active FROM users WHERE email = $1",
      [email],
    );

    if (result.rowCount === 0) {
      throw createHttpError(401, "Invalid email or password");
    }

    const user = result.rows[0];
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw createHttpError(401, "Invalid email or password");
    }

    // Deactivated accounts are indistinguishable from bad credentials on
    // purpose -- do not reveal that the email exists but is disabled.
    if (user.is_active === false) {
      throw createHttpError(401, "Invalid email or password");
    }

    const token = await createSession(user.user_id);
    const session = await getSessionUser(token);

    res.setHeader("Set-Cookie", serializeSessionCookie(token));
    return res.json(session);
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", async (req, res, next) => {
  const header = req.headers.cookie ?? "";
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("linko_session="))
    ?.slice("linko_session=".length);

  try {
    await destroySession(token ? decodeURIComponent(token) : undefined);
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json(req.auth);
});

export default router;
