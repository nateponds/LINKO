# LINKO Backend

Minimal Express and PostgreSQL scaffold for the Sprint 1 backend foundation.

## Codebase Overview

The backend is organized into a modular Express app connected to a PostgreSQL database.

**Core Files:**

- `src/server.js` - The production entry point. Only binds the HTTP port (default `5000`).
- `src/app.js` - Creates and configures the Express application, attaching JSON body parsing, route handlers, and error middleware. Separated from `server.js` so tests can run without binding ports.
- `src/db.js` - Manages the PostgreSQL connection pool singleton (`pg`).
- `src/migrate.js` - A custom, idempotent database migration runner that applies all `.sql` files in the `migrations/` directory using SQL transactions.
- `migrations/026_inventory_batches.sql` - Batch expiry entity linked to products, with indexed expiry checks and no duplicate stock total.
- `src/routes/inventoryBatches.js` - Paginated expiry reads and batch management scoped to the active wholesaler business (administrators may access all businesses).
- `migrations/001_initial_schema.sql` - The initial database schema defining users, businesses, warehouses, products, inventory items, and supplier profiles.
- `src/routes/` - Contains the Express routers for individual domains (`inventory.js`, `suppliers.js`).
- `src/middleware/errorHandler.js` - Shared Express error-handling middleware that ensures all API errors return a consistent JSON shape.
- `src/app.test.js` - The integration test suite powered by Node's built-in `node:test` and `node:assert` modules.

## Setup

```sh
npm install
npm run migrate
npm start
```

Set `DATABASE_URL` (e.g. in a `.env` file based on `.env.example`) to a PostgreSQL database before running migrations.

## Scripts

- `npm start` starts the API server.
- `npm run migrate` applies SQL files in `migrations/`.
- `npm test` runs the Node test suite.

## Routes

- `GET /health`
- `GET /api/inventory-batches`
- `POST /api/inventory-batches`
- `PATCH /api/inventory-batches/:id`
- `DELETE /api/inventory-batches/:id`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/:id`

Inventory stock is managed through `/api/products`; the former `/api/inventory`
routes were removed in migration `019`. The expiry endpoints are database-backed
and documented in `docs/API_CONTRACTS.md`. Run migrations before starting the
server or seeding demo data.
