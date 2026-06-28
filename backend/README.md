# LINKO Backend

Minimal Express and PostgreSQL scaffold for the Sprint 1 backend foundation.

## Setup

```sh
npm install
npm run migrate
npm start
```

Set `DATABASE_URL` to a PostgreSQL database before running migrations.

## Scripts

- `npm start` starts the API server.
- `npm run migrate` applies SQL files in `migrations/`.
- `npm test` runs the Node test suite.

## Routes

- `GET /health`
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PATCH /api/suppliers/:id`

`GET` routes currently return empty contract-shaped lists. Mutating routes return `501` until database-backed endpoint work begins.
