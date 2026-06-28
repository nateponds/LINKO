import pg from "pg";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({ connectionString });
}

let pool;

export function getPool() {
  // Reuse one pool for the whole app. A pool manages several PostgreSQL
  // connections internally, so routes should call query() instead of creating
  // a new connection for every request.
  pool ??= createPool();
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}
