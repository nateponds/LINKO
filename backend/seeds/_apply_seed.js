import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedFile = path.join(__dirname, "dev_seed.sql");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:root@localhost:5432/LINKO",
});

try {
  const sql = await readFile(seedFile, "utf8");
  console.log("Applying dev_seed.sql to database...");
  await pool.query(sql);
  console.log("Seed applied successfully.");

  // Quick verification
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int           AS users,
      (SELECT COUNT(*) FROM businesses)::int       AS businesses,
      (SELECT COUNT(*) FROM addresses)::int        AS addresses,
      (SELECT COUNT(*) FROM products)::int         AS products,
      (SELECT COUNT(*) FROM orders)::int           AS orders,
      (SELECT COUNT(*) FROM order_items)::int      AS order_items,
      (SELECT COUNT(*) FROM invoices)::int         AS invoices,
      (SELECT COUNT(*) FROM parcels)::int          AS parcels,
      (SELECT COUNT(*) FROM tracking_logs)::int    AS tracking_logs,
      (SELECT COUNT(*) FROM branches)::int         AS branches,
      (SELECT COUNT(*) FROM couriers)::int         AS couriers,
      (SELECT COUNT(*) FROM warehouses)::int       AS warehouses,
      (SELECT COUNT(*) FROM business_memberships)::int AS memberships,
      (SELECT COUNT(*) FROM notifications)::int    AS notifications,
      (SELECT COUNT(*) FROM payments)::int         AS payments
  `);
  console.log("\nRow counts after seeding:");
  console.table(counts.rows[0]);
} catch (err) {
  console.error("Seed failed:", err.message);
  if (err.position) {
    console.error("SQL error near position:", err.position);
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
