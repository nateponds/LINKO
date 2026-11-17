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
import { createBusiness, parseBusiness, validateBusinessType } from "../services/businesses.js";

const router = Router();

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function deriveUsername(email) {
  return email.slice(0, 50);
}

router.post("/register", async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name.trim() : "";
  const { businessName, businessType } = parseBusiness(req.body);

  if (!email || !password || !fullName || !businessName || !businessType) {
    return next(createHttpError(400, "Missing required fields"));
  }

  if (password.length < 8) {
    return next(createHttpError(400, "Password must be at least 8 characters long"));
  }

  try {
    validateBusinessType(businessType);
  } catch (error) {
    return next(error);
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
      `INSERT INTO users (username, email, full_name, password_hash, global_role)
       VALUES ($1, $2, $3, $4, NULL)
       RETURNING user_id, email, full_name, global_role`,
      [deriveUsername(email), email, fullName, passwordHash],
    );

    const membership = await createBusiness(client, userResult.rows[0].user_id, businessName, businessType);

    const token = await createSession(userResult.rows[0].user_id, client);
    await client.query("COMMIT");

    res.setHeader("Set-Cookie", serializeSessionCookie(token));
    return res.status(201).json({
      user: userResult.rows[0],
      memberships: [membership],
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
