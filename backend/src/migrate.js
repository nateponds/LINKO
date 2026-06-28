import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");

async function migrate() {
  const pool = createPool();
  const client = await pool.connect();

  try {
    // This table records which migration files already ran. That makes
    // npm run migrate safe to run more than once on the same database.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file],
      );

      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(path.join(migrationsDir, file), "utf8");

      // Each migration runs inside a transaction. If the SQL fails halfway,
      // PostgreSQL rolls the whole file back instead of leaving a half-built DB.
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");

      console.log(`Applied ${file}`);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
