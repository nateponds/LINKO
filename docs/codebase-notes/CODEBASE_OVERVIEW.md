# LINKO Current Codebase Overview

This document explains the codebase as it exists right now. It is meant for student developers who are still getting comfortable reading JavaScript, React, Express, and PostgreSQL.

## Big Picture

LINKO currently has two main parts:

- The root project is the frontend Vite/React app.
- `backend/` is a separate Node.js backend package using Express and PostgreSQL.

The frontend files exist, but many of the React components and pages are still placeholders. The backend scaffold is the newest working foundation: it can run tests, define routes, connect to PostgreSQL, and apply the first migration.

## Important Folders

```text
LINKO/
  src/                    Frontend React app files
  backend/                Separate backend API package
  docs/                   Planning and project documentation
  docs/codebase-notes/    Running notes about how the current codebase works
```

## Frontend Status

The frontend uses Vite and React. The root `package.json` has these scripts:

```sh
npm run dev
npm run build
npm run lint
npm run preview
```

The frontend entry point is `src/main.jsx`, and the top-level component is `src/App.jsx`.

At the moment, the planned frontend structure is present:

- `src/pages/`
- `src/layouts/`
- `src/components/navigation/`
- `src/components/ui/`
- `src/features/`

Many of those files are currently empty placeholders. That means the folder structure is ready, but the actual app shell and pages still need to be implemented.

## Backend Status

The backend lives in `backend/` and has its own `package.json`. Run backend commands from inside that folder:

```sh
cd backend
npm install
npm test
npm start
```

The backend scripts are:

- `npm start`: starts the Express API server.
- `npm run migrate`: runs SQL migration files against PostgreSQL.
- `npm test`: runs the backend tests with Node's built-in test runner.

## Backend Request Flow

The backend starts in this order:

1. `backend/src/server.js` imports `createApp()`.
2. `backend/src/app.js` creates and configures the Express app.
3. `server.js` calls `app.listen(...)` to open the HTTP port.
4. A request like `GET /api/products` enters `app.js`.
5. `app.js` sends that request to `backend/src/routes/products.js`.
6. If no route matches, `app.js` returns a JSON `404`.
7. If a route throws an error later, `errorHandler.js` formats the error response.

`createApp()` is separate from `app.listen()` on purpose. Tests can create the app without permanently opening port `5000`.

## Backend Files

### `backend/src/app.js`

Creates the Express app. This is where middleware and routers are connected.

Important idea: Express checks routes in the order they are added. That is why the `404` handler and error handler are near the bottom.

### `backend/src/server.js`

Starts the app on a port. The default is `5000`, but it can be changed with `PORT`.

### `backend/src/db.js`

Creates a PostgreSQL connection pool. Future route code should use the exported `query()` helper rather than creating new database connections by hand.

### `backend/src/migrate.js`

Runs SQL files from `backend/migrations/`.

It also creates a `schema_migrations` table. That table records which migration filenames already ran, so running `npm run migrate` again will skip completed migration files.

### `backend/src/routes/suppliers.js`

Owns routes under `/api/suppliers`.

Current routes:

- `GET /api/suppliers` returns `[]`.
- `POST /api/suppliers` returns `501 Not Implemented`.
- `PATCH /api/suppliers/:id` returns `501 Not Implemented`.

The next backend step is to connect these routes to `businesses` and `supplier_profiles`.

### `backend/src/middleware/errorHandler.js`

Formats errors as JSON. Keeping this in one file helps future routes return consistent API errors.

### `backend/src/app.test.js`

Tests the current backend scaffold. These tests prove that the health route, placeholder API routes, and `501` placeholder behavior still work.

## Database Migration

The first migration is:

```text
backend/migrations/001_initial_schema.sql
```

It creates these tables:

- `users`
- `businesses`
- `user_businesses`
- `warehouses`
- `categories`
- `products`
- `supplier_profiles`

(The `inventory_items` and `inventory_transactions` tables, their mutation
trigger, and their indexes were created here originally but dropped in
migration `019` — stock lives on `products.stock_quantity` instead.)

It also creates:

- an index for SKU lookup

The migration uses lowercase `snake_case` table names because that is the normal PostgreSQL style and avoids quoting table names later.

## Current API Surface

```text
GET    /health
GET    /api/suppliers
POST   /api/suppliers
PATCH  /api/suppliers/:id
```

The API shape is guided by `docs/API_CONTRACTS.md`. The current backend does not yet fully implement those contracts. It only creates the route structure and clear placeholders.

## Where To Build Next

Build in this order:

1. Add database reads for `GET /api/suppliers`.
2. Add validation for request bodies.
4. Implement `POST` and `PATCH` routes.
5. Add tests for successful and failed API calls.
6. Add authentication only after the basic data routes are working.

## Rules Of Thumb For This Codebase

- Keep route files focused on one domain.
- Put shared database code in `backend/src/db.js`.
- Put SQL schema changes in new migration files, never by editing an already-applied migration.
- Add tests when a route starts doing real work.
- Update this document when the architecture changes.
