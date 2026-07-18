# API Agent Seeder — design spec

Status: **spec only, not built.** Product of a `/grill-me` session (2026-07-18).

## Goal

Replace tedious hand-authoring of `backend/seeds/dev_seed.sql` for *demo variety*.
Generate realistic demo data at any scale by driving the **real Express
endpoints** — so every row passes real validation, triggers, routing, and pin
gates. Plain `INSERT INTO` is rejected on purpose: it skips all of that.

## The core lesson (why this design, not the obvious one)

> An LLM in the loop per-record is linear token cost. Harness design = getting
> the LLM **out** of the loop for the repetitive part, **in** it only for the
> judgment part.

Three architectures considered:

| Arch | Shape | LLM cost | Verdict |
|---|---|---|---|
| A — agent-as-runtime | LLM decides every call | `O(N)` | The trap. Rejected. |
| **B — agent-as-author** | LLM writes personas once; plain runner executes N | `O(1)` | **Chosen.** |
| C — hybrid | B + escalate only *unclassified* API failures to LLM | `O(failures)` | Hook stubbed, not built. |

## Ownership split (the whole insight, made literal)

The line: **LLM owns anything where a human would notice incoherence** (a
wholesaler named "Manila Rice Trading" selling laptops; a Cebu business with
Luzon coords; a barangay that doesn't exist). **Code owns anything a randomizer
does indistinguishably** (counts, jitter, timestamps).

### LLM-authored (once → `personas.json`, `O(1)` tokens)

Business-level:
- `business_name` — realistic PH MSME/wholesaler names
- `business_type` — `buyer` | `wholesaler` (strategic mix, not 50/50 random)
- `full_name` — owner/contact, coherent with the business
- email local-part — derived from name/business (runner adds unique suffix)
- `contact_number` — PH mobile format plausibility

Address (all 5 required non-empty — settings.js:63):
- `province` — real PH province
- `city_municipality` — real city **in that province** (coherent pairing)
- `barangay` — plausible for that city
- `street_address` — realistic street name/number
- `postal_code` — correct-ish for the city
- `latitude` / `longitude` — coords that land **in that city** (load-bearing:
  wrong coords still pass the funnel but break map realism + routing sense)

Products (wholesaler personas, `POST /products`):
- `product_name` — real wholesale goods, coherent with implied trade
- `description` — plausible blurb
- `sku` — realistic pattern
- `category_id` — sensible pick (LLM chooses from `GET /categories`)
- `image_url` — plausible or null

Relational realism (subtle, high-value):
- which buyer orders which wholesaler — coherent pairing beats random
- product↔business fit — rice trader sells rice, not electronics
- geographic clustering — some near pairs, some far, so routing looks real

### Code-owned (runner, `O(0)` tokens)

count, email suffix, timestamps, `weight_kg`, `quantity`, `stock_quantity`,
`unit_price` (jitter within validator envelopes), `tier_id` (sampled),
buyer→wholesaler pairing loop.

### System-owned (real API + DB triggers, `O(0)` tokens)

`sender_id` from session, branch routing, delivery paths, tracking scan
sequence, route snapshots, payment amounts, `shipping_fee`, refs, pin gates.

"Let it do a million" = a `--count N` flag on the runner. Persona file stays
~30–50 entries; runner recombines + jitters. N is never N agent turns.

## What the codebase confirms (verified 2026-07-18)

- **`POST /api/auth/register`** (`backend/src/routes/auth.js:34`) self-bootstraps
  a persona in one transaction: user + business + placeholder **unpinned**
  address + membership, and **returns a session cookie** (`Set-Cookie:
  linko_session=...`). Register *is* login — no separate login call needed.
- Auth is a **cookie session token**, not a Bearer JWT. Runner reuses the
  `Set-Cookie` value on subsequent calls for that persona.
- **`business_type` must be `buyer` or `wholesaler`** (`auth.js:14,50`).
  Register **cannot** create `logistics`/`courier`. → **Decision: reuse the
  existing `logistics@linko.test` from `dev_seed.sql` as the fixed parcel
  coordinator.** Logistics is infra, not demo variety.
- Register **hard-collides on duplicate email** → `409` (`auth.js:60`). Makes
  append-only safe *iff* the runner uniquifies emails per run.

## Decisions (from grilling)

- **Q1 scale:** not a million now, but nothing may architecturally forbid it. →
  `--count` flag + bounded concurrency. Not a systems rewrite.
- **Q2 validation:** must go through real endpoints. Non-negotiable. Kills SQL.
- **Q3 auth:** the **AI agent** never logs in (writes JSON only). The **runner**
  authenticates — **once per persona, token reused** for that persona's N calls.
  Not per-call (insane), not once-global (every row same business → fraud graph).
  Auth *is* part of the validation (derives `sender_id`, RBAC). Zero LLM tokens.
- **Q4 password:** fixed `Password123!` (demo, fake). Passes 8-char min.
- **Q5 idempotency:** **append-only.** No wipe. Runner adds per-run email suffix
  (e.g. `buyer+r3p07@linko.test`) so re-runs never collide.
- **Logistics actor:** reuse `logistics@linko.test` (fixed coordinator).

## Non-negotiables (correctness, not laziness)

1. **Bounded concurrency** (~5–10 in flight). A naive N-POST loop exhausts the
   `pg` pool and hammers Supabase. Simple promise-pool, no library.
   `// ponytail: fixed-size promise pool; add backpressure/retry if Supabase 429s`
2. **Never target production.** Refuse on `NODE_ENV=production` (same guard as
   `seed_demo.js`). Base URL defaults to `http://localhost:5001`; must be passed
   explicitly to hit anything else. Demo data lands in local/staging first.

## Planned artifacts

```
backend/scripts/seed_via_api/
  personas.json         # LLM writes ONCE. ~30-50 rich buyer/wholesaler identities.
  run.mjs               # plain runner: register → reuse cookie → book via real API.
                        #   flags: --count N --base-url URL --concurrency K
                        #   escalation hook: on unclassified failure, dump
                        #   {payload, status, body} for LLM. STUB — logs only in v1.
```

Runner flow per persona:
1. `POST /register` with suffixed email + LLM-authored identity → capture cookie.
2. `PUT /api/settings/location` with LLM-placed coords → passes pin gate.
3. (buyer) create order / (wholesaler) product+inventory, per role via real routes.
4. book parcel(s) — `sender_id` derives from session; routing/snapshot run server-side.
5. bounded concurrency across personas; append-only.

## The funnel (this IS the runner — not an endpoint pick-list)

Verified against orders.js / products.js / logistics.js (2026-07-18). The
endpoints form a hard dependency chain, not a menu. Each stage gates the next;
skipping one hits a 409/400. `--depth` decides where the runner stops.

```
register(buyer)              register(wholesaler)
   |                             |
   PUT /api/settings/location <--+--> PUT /api/settings/location   [pin gate]
   |                                        |
   |                                 POST /api/products            [stock to sell]
   |                                        |
   +-----------> POST /api/orders <---------+   [buyer orders wholesaler product;
                     |                           buyer MUST be pinned -> 409 else]
        PATCH /api/orders/:id/status 'accepted'  [wholesaler; -> invoice + stock--]
                     |
        PATCH /api/orders/:id/status 'preparing'
                     |
        PATCH /api/orders/:id/status 'shipped'   [both pinned -> AUTO-CREATES
                     |                            parcel + payment + tracking log
                     |                            + route snapshot. Free parcels.]
        POST /api/parcels/:id/tracking           [logistics@linko.test scans
                     |                            -> Delivered / Returned]
```

Key discovery: **the order path yields parcels for free.** `PATCH ...'shipped'`
(orders.js:513-589) auto-creates the parcel, payment, first tracking log, and
route snapshot from the order. The runner does NOT call `POST /api/parcels`
directly for the marketplace flow — shipping an order does it, server-side, with
correct routing.

`--depth` (default **`delivered`**, chosen 2026-07-18):

| Depth | Stops after | Grader sees |
|---|---|---|
| `locations` | PUT /location | businesses pinned on the map |
| `orders` | accept | + orders, invoices, stock decrement |
| `shipped` | ship | + parcels, payments, route snapshots |
| **`delivered`** | tracking scans | + tracking_logs, Delivered/Returned lifecycle |

## Numeric jitter — envelopes from the validators (runner-owned, 0 tokens)

| Field | Legal (code) | Demo jitter |
|---|---|---|
| `weight_kg` | `> 0` (orders.js:486, logistics.js:551) | 0.5–25 kg |
| `quantity` | positive int (orders.js:359) | 1–50 |
| `stock_quantity` | int ≥ 0 (products.js:188) | 20–500 |
| `unit_price` | number ≥ 0 (products.js:179) | 50–5000 |
| `tier_id` | must exist | sample `GET /api/service-tiers` |
| coords | paired, in-range, no null-island | **LLM per persona (real PH cities)** |

**Load-bearing coords:** order placement 409s if the buyer isn't pinned
(orders.js:387); shipping 409s if either side isn't pinned (orders.js:536-543).
So LLM-placed real coords aren't cosmetic — they're what stops the funnel from
409ing. (Confirms the Q3a instinct.)

## Escalation hook (Arch C door) — classification is cheap, LLM only on surprise

Endpoints return structured `{ error: { message } }`, mapped 400/403/404/409.
Runner carries a known-error table; ~95% classify with no LLM:

- `409 "Pin your business location..."` → runner skipped a pin. Code bug.
- `400 "all order items must come from one wholesaler"` → runner mixed products.
- `409 "Email already registered"` → suffix collision. Code bug.

`// ponytail: known-error table + log-unknown. Wire LLM only if unknowns pile up.`
v1: on an **unrecognized** message → append `{payload, status, message}` to a
file. Human reads it, decides. No LLM call in v1.

## Status: build-ready

All three "open" items resolved by the code. No preference decisions left except
per-run knobs (`--count`, `--depth`, `--base-url`, `--concurrency`).
