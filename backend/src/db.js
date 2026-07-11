import pg from "pg";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  // Managed Postgres (Supabase) presents a cert chain Node's default trust
  // store rejects (SELF_SIGNED_CERT_IN_CHAIN). Enable TLS but skip chain
  // verification whenever the URL asks for SSL. Local/staging Docker Postgres
  // has no sslmode in its URL, so it stays plain.
  // ponytail: rejectUnauthorized:false trusts the tunnel; swap for a pinned
  // Supabase CA (sslrootcert + verify-full) if the DB link needs MITM protection.
  const wantsSsl = /\bsslmode=(require|prefer|verify-ca|verify-full|no-verify)\b/.test(
    connectionString,
  );

  return new Pool({
    connectionString,
    ssl: wantsSsl ? { rejectUnauthorized: false } : false,
  });
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
