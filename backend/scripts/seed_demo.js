// Demo seed runner — `npm run seed:demo`.
//
// Idempotent RESET: dev_seed.sql already wipes the transactional tables in
// reverse-FK order (TRUNCATE ... CASCADE) and restarts sequences before
// re-inserting the 4 demo accounts and their sample data, so re-running this
// script yields the same clean state every time.
//
// Safety: refuses to run when NODE_ENV === "production" unless --force is
// passed, so a production database is never wiped by accident. Demo data must
// stay out of production (see docs/DEPLOYMENT.md seed strategy).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPool } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFile = path.join(__dirname, "..", "seeds", "dev_seed.sql");

const force = process.argv.includes("--force");

if (process.env.NODE_ENV === "production" && !force) {
  console.error(
    "Refusing to seed: NODE_ENV=production. Demo data must not touch production.\n" +
      "If you really mean to, re-run with --force.",
  );
  process.exit(1);
}

const pool = createPool();

try {
  const sql = await readFile(seedFile, "utf8");
  console.log(`Applying ${path.relative(process.cwd(), seedFile)} (idempotent reset)...`);
  await pool.query(sql);
  console.log("Demo data seeded successfully.");

  const summary = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int                AS users,
      (SELECT COUNT(*) FROM businesses)::int           AS businesses,
      (SELECT COUNT(*) FROM business_memberships)::int AS memberships,
      (SELECT COUNT(*) FROM products)::int             AS products,
      (SELECT COUNT(*) FROM orders)::int               AS orders,
      (SELECT COUNT(*) FROM invoices)::int             AS invoices,
      (SELECT COUNT(*) FROM parcels)::int              AS parcels,
      (SELECT COUNT(*) FROM branches)::int             AS branches,
      (SELECT COUNT(*) FROM couriers)::int             AS couriers
  `);
  console.log("\nRow counts after seeding:");
  console.table(summary.rows[0]);

  const accounts = await pool.query(
    `SELECT email, global_role
       FROM users
      WHERE email IN ('buyer@linko.test','wholesaler@linko.test','logistics@linko.test','admin@linko.test')
      ORDER BY email`,
  );
  console.log("\nDemo login accounts (password: Password123!):");
  console.table(accounts.rows);
} catch (err) {
  console.error("Seed failed:", err.message);
  if (err.position) {
    console.error("SQL error near position:", err.position);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
