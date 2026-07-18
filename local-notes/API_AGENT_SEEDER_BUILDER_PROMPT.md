# Smoke-test handoff — API Agent Seeder (live run)

You are the **tester**. The seeder is built and bug-fixed. Your ONE job: run it
live against a LOCAL backend at the smallest useful scale, confirm the full
funnel works end-to-end, and report exactly what happened. Do NOT redesign, do
NOT expand personas, do NOT commit anything. If something fails, diagnose and
report — fix ONLY if the fix is small and obvious (typo, wrong flag); otherwise
STOP and report.

## Context (trust these — already verified)

- Seeder lives at `backend/scripts/seed_via_api/run.mjs`, npm script `seed:api`.
- It drives the REAL Express endpoints (register → pin location → create product
  → place order → accept → preparing → ship → tracking scans) so every row passes real
  validation/triggers/routing. Append-only. Prod-guarded (refuses non-localhost
  and NODE_ENV=production without --force).
- All demo accounts and registered personas use password `Password123!`.
- Seeded world is CEBU (branches: Cebu City + Mandaue). Example personas are
  Cebu-area on purpose so routing is sane.

## Prerequisites — CHECK BOTH before running. Stop if either missing.

1. **Backend up on `http://localhost:5001`.** Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/health` → expect `200`. If not running, start it: from `backend/`, `npm start` (needs DATABASE_URL in backend/.env). Report if you cannot start it.
2. **Demo seed applied** (need `logistics@linko.test` + an active courier + Cebu branches). Verify by logging in:
   `curl -s -X POST http://localhost:5001/api/auth/login -H "Content-Type: application/json" -d '{"email":"logistics@linko.test","password":"Password123!"}' -o /dev/null -w "%{http_code}"` → expect `200`.
   If `401`, run `npm run seed:demo` from `backend/` first (it applies dev_seed.sql). Report if seed fails.
3. **personas.json exists** at `backend/scripts/seed_via_api/personas.json`. It is
   gitignored. If absent, copy the example:
   `cp backend/scripts/seed_via_api/personas.example.json backend/scripts/seed_via_api/personas.json`.

## The run

From `backend/`:

```
npm run seed:api -- --count=2 --depth=delivered
```

`--count=2` = one wholesaler + one buyer = one complete funnel walk. That is the
smallest run that exercises every stage through a Delivered parcel.

(Optional first: `npm run seed:api -- --dry-run --count=2` to confirm payload
shaping with no HTTP. The real run above is the actual test.)

## What success looks like

The run ends with a `console.table` summary. For `--count=2` expect roughly:
- Wholesalers Registered: 1
- Buyers Registered: 1
- Locations Pinned: 2
- Products Created: 1
- Orders Placed: 1
- Orders Accepted: 1
- Orders Preparing: 1
- Orders Shipped: 1
- Parcels Delivered: 1  (OR Parcels Returned: 1 — ~10% random; either is fine)
- Errors Encountered: 0

Then verify the data actually landed (as the coordinator):
- `GET /api/parcels` (with the coordinator cookie, or just re-login) returns the
  new parcel with a `current_status` of `Delivered` (or `Returned`).
- Confirm `backend/scripts/seed_via_api/.seed-unknown-errors.jsonl` is EMPTY or
  absent. Any line in it = an unclassified API error the runner hit — paste it.

## Report back (concise)

1. Prereq results (health 200? coordinator login 200? seed needed?).
2. The full console.table summary from the run.
3. Contents of `.seed-unknown-errors.jsonl` if non-empty (verbatim).
4. Parcel final status confirmation (Delivered/Returned).
5. Any step where `Errors Encountered > 0` — which step, what message.
6. Verdict: PASS (full funnel green, 0 errors) or FAIL (what broke, where).

Do not commit, do not scale up, do not touch production. Local smoke test only.
