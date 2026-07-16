import { createPool } from "../src/db.js";

const pool = createPool();
try {
  const { rows } = await pool.query(
    "SELECT current_database() AS db, version() AS version, now() AS now",
  );
  console.log("Connected:", rows[0].db);
  console.log(rows[0].version);
} finally {
  await pool.end();
}
