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

// Mint a collision-proof parcel tracking number from the DB sequence
// (migration 016), scoped to the caller's open transaction so a parcel
// insert and its ID never disagree on rollback.
export async function nextParcelId(client) {
  const { rows } = await client.query(
    "SELECT 'LKO-' || lpad(nextval('parcel_id_seq')::text, 8, '0') AS id",
  );
  return rows[0].id;
}
