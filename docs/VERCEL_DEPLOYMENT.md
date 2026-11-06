# Vercel deployment

The `linko` Vercel project serves the Vite frontend and the Express API on
`linko.nateponds.com`. `api/index.js` exports the app; `vercel.json` routes
API and health requests to it and serves the SPA for other routes.

Connect the project to `nateponds/LINKO` with `main` as the production branch.
Vercel then builds and deploys each push to `main`. The production environment
requires `DATABASE_URL` and `VITE_MAPBOX_TOKEN` in Vercel project settings.
Deployments do not run database migrations.

Before releasing changes, run `node --test tests/vercel-entry.test.js` and
`npm run build`. After deployment, check `/health` and a database-backed flow.
