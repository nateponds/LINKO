# API-Driven Demo Data Seeder

This directory contains a script to seed realistic demo data in the LINKO application by driving the **real Express API endpoints**. 

Unlike direct SQL database inserts (which bypass schema triggers, validation, and business logic routing), this seeder registers new users, logs them in, sets locations, posts products, places orders, and transitions statuses exactly as a real user would.

## File Structure

* `run.mjs`: The runner script executing the HTTP requests.
* `personas.example.json`: Pre-defined realistic MSME buyer and wholesaler templates (including coordinates and Philippine address fields).
* `personas.json`: The active template file used during execution (gitignored to allow custom local editing).
* `README.md`: This instruction manual.

---

## Prerequisites

Before running the seeder, ensure you have set up the following:

1. **Backend Server Running**
   The backend Express server must be online (defaults to `http://localhost:5001`).
   ```bash
   cd backend
   npm start
   ```

2. **Core Database Seeds Applied**
   The database must already contain the service tiers, categories, and core coordinator/admin accounts from the dev seed:
   ```bash
   cd backend
   npm run seed:demo
   ```

3. **Active Personas File**
   Copy the example personas file to initialize the gitignored `personas.json`:
   ```bash
   cp backend/scripts/seed_via_api/personas.example.json backend/scripts/seed_via_api/personas.json
   ```

---

## Usage

All commands should be executed from the `backend/` directory.

### 1. Verification (Dry Run)
Check the payload construction and scheduling flow without making actual HTTP requests:
```bash
npm run seed:api -- --dry-run --count=2
```

### 2. Live Seeding Run
Execute a live seed to register accounts, place orders, and progress them to delivery:
```bash
npm run seed:api -- --count=2 --depth=delivered
```

---

## CLI Options

You can customize the run by appending standard arguments to `npm run seed:api --`:

| Option | Default | Description |
|---|---|---|
| `--count=<number>` | `2` | Number of personas (split into buyers and wholesalers) to register and process. |
| `--depth=<level>` | `delivered` | Funnel gate to stop at (see Depth Levels table below). |
| `--base-url=<url>` | `http://localhost:5001` | Base URL of the target API. |
| `--concurrency=<number>`| `5` | Maximum number of concurrent personas processing. |
| `--force` | `false` | Bypass staging/production env check guards (safety feature). |
| `--dry-run` | `false` | Run through calculations and print mock outputs without sending API requests. |

---

## Funnel & Depth Levels

The script drives a strict dependency chain mapping the actual business rules of the platform:

```
[register] ──> [settings/location (pin)] ──> [products (wholesalers)] 
                                                      │
[track (Delivered/Returned)] <── [ship (shipped)] <── [prepare (preparing)] <── [accept (accepted)] <── [orders (POST)]
```

Use the `--depth` flag to control how far down the pipeline the script progresses:

| Depth Level | Stops After | Side Effects Created |
|---|---|---|
| `locations` | Pinned Address (`PUT /api/settings/location`) | Pinned buyer/wholesaler locations. |
| `orders` | Placed Order (`POST /api/orders`) | `pending` order records. |
| `shipped` | Ship Order (`PATCH /orders/:id/status` as 'shipped') | Auto-generates courier parcels, invoices, and route snapshots. |
| `delivered` | Scanning Logs (`POST /api/parcels/:id/tracking`) | Complete tracking logs lifecycle resulting in `Delivered` or `Returned` parcels. |

---

## Log Outputs

* **Successful Runs:** Ends with a `console.table` summarizing all registered actors and status metrics.
* **Unrecognized Failures:** Any unhandled API failures (e.g. schema/validation validation rejections) will be appended to `backend/scripts/seed_via_api/.seed-unknown-errors.jsonl` for troubleshooting.
