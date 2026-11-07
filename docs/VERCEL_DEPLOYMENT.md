# Vercel deployment

The `linko` Vercel project serves the Vite frontend and Express API on
`linko.nateponds.com`. The deployment configuration was merged into `main` in
`39f23e7`; `c51f69e` records the Git connection to `nateponds/LINKO`, with `main`
as the production branch. Pushes to `main` trigger Vercel deployments.

## Application setup

- `api/index.js` exports the existing Express app without opening a server port.
- `vercel.json` routes `/api/*` and `/health` to that function, and application
  routes to the Vite SPA. Frontend and API share an origin for session cookies.
- Install: `npm ci && npm ci --prefix backend`.
- Build: `npm run build`; output: `dist`.
- Configure sensitive `DATABASE_URL` only on the server. Configure a publishable
  `VITE_MAPBOX_TOKEN` for the frontend; Vite embeds it in browser assets.
- Deployments do not run migrations or seed data.

## Validate and release

1. Run `node --test tests/vercel-entry.test.js backend/src/middleware/errorHandler.test.js`,
   `npm run lint`, and `npm run build`.
2. Review and merge changes to `main`, then check the Vercel build and function
   logs. Keep deployment protection enabled.
3. Verify `/`, a direct application route, `/health`, login, session persistence,
   authenticated data, and logout. `/health` checks the app, not database access.

The self-hosted Docker deployment workflow is removed, matching `main`, so a
push does not also redeploy the former hosting stack. Local development still
uses Vite's API proxy and the standalone Express server.

## Error diagnostics

Unexpected HTTP 500 errors log the error name, code, failing hostname, and
database host, port, and username when `DATABASE_URL` can be parsed. Passwords,
connection strings, error messages, SQL, and request bodies are omitted. The
client still receives only `Internal server error`. Missing or malformed database
configuration must not break error handling. Treat server logs as internal data.

## Historical troubleshooting

The preserved October 26 notes reported a rejected database credential (`28P01`)
and pending DNS cutover. Those are historical observations, not verified current
blockers. They predate the November 6 Git deployment setup. Do not recreate roles,
rotate credentials, or change DNS based solely on those notes. If a database-backed
flow fails now, inspect current function logs and deployment settings first.
