<div align="center">
  <img src="./public/images/linko.png" alt="LINKO Logo" />
</div>
<br>

<div align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/nateponds/LINKO/commits/main"><img src="https://img.shields.io/github/last-commit/nateponds/LINKO/main" alt="Last Commit"></a>
  <img src="https://img.shields.io/badge/Status-In%20Development-yellow.svg" alt="Status: In Development">
</div>

<h1 align="center">LINKO</h1>

> **LINKO** is a buyer-wholesaler marketplace and operations platform for MSMEs and other businesses. It helps buyers discover reliable wholesalers, compare supply options, organize inventory work, and prepare for quote, order, and fulfillment workflows in one centralized place.

The product is designed for small and growing businesses that need practical tools for procurement and stock visibility without taking on the complexity of a full enterprise supply-chain system. LINKO focuses on the direct buyer-wholesaler relationship: *who can supply, where they can serve, how buyers can connect with them, and how those connections can become operational workflows over time.*

> [!IMPORTANT]
> **Pre-launch status.** LINKO is not production-launched. The public deployment at `linko.nateponds.com` is a showcase, and every database in use (local development, staging, and the showcase itself) contains disposable development fixtures — seeded demo data, not real customer records. Schema and seed changes may reset these databases at any time; do not build migrations, backfills, or compatibility layers around preserving them.

---

## Checkpoint Implementation Focus: Courier/Parcel Tracking

LINKO's first checkpoint-ready module is the **Courier/Parcel Tracking** workflow described in [local-notes/course-deliverable.md](./local-notes/course-deliverable.md). This fits the marketplace concept as the fulfillment layer that handles what happens after a buyer, wholesaler, or business needs a package moved: sender and receiver details, package weight, shipping fee calculation, current delivery status, and a tracking history from pickup through delivery.

### Required Core Tables

| Course requirement | Implemented as | Where it appears |
| --- | --- | --- |
| `Service_Tiers` | `service_tiers` | Delivery speed, estimated days, base fee, and per-kg/per-km rates used for shipping fee calculation. |
| `Customers` | `businesses` + `addresses` | Shared sender/receiver records with contact details and locations. |
| `Branches` | `branches` | Physical logistics hubs where parcels are processed. |
| `Parcels` | `parcels` | Master package record with sender, receiver, weight, dimensions, service tier, fee, and delivery estimate. |
| `Tracking_Logs` | `tracking_logs` | Scan/status history for every parcel movement or status update. |

### Submission Evidence

- Database implementation: [backend/migrations/002_logistics_schema.sql](./backend/migrations/002_logistics_schema.sql), [backend/migrations/003_linko_schema.sql](./backend/migrations/003_linko_schema.sql), and later logistics/auth integration migrations.
- Course requirement summary: [local-notes/course-deliverable.md](./local-notes/course-deliverable.md).
- Demo walkthrough: [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md), especially the Logistics Coordinator and Courier journeys.
- Backend routes and tests: [backend/src/routes/logistics.js](./backend/src/routes/logistics.js), [backend/src/app.test.js](./backend/src/app.test.js), [backend/src/logistics-workflow.test.js](./backend/src/logistics-workflow.test.js), and [backend/src/ownership.test.js](./backend/src/ownership.test.js).

> **Implementation note:** LINKO derives each parcel's current status from the latest `tracking_logs` row. This keeps the tracking history as the source of truth while the UI still shows the current status for each parcel.

---

## Product Direction

LINKO is being built around four near-term pillars:

1. **Courier/Parcel Tracking**: The checkpoint-ready operational core, covering parcels, service tiers, branches, tracking logs, and delivery status.
2. **Wholesaler Discovery**: Helping buyers looking for supply partners.
3. **Inventory Visibility**: Tools for businesses tracking products, stock levels, warehouses, and movement history.
4. **Proximity-Based Matching**: Starts simple, local, and explainable.

*(Note: The current scope focuses exclusively on direct buyer-wholesaler interactions. We do not model the full upstream/downstream manufacturer or distributor chains yet).*

---

## Codebase Snapshot

This repository contains the web application, backend scaffold, and planning documents for LINKO. 

**Tech Stack & Architecture**
- **Frontend**: React 19, Vite 8, plain JSX
- **Backend**: Node.js, Express 5, PostgreSQL, and a custom migration runner
- **Checkpoint API Focus**: `/api/parcels`, `/api/service-tiers`, `/api/branches`, `/api/couriers`, and `/api/parcels/:id/tracking`
- **Marketplace Expansion Areas**: `/api/inventory`, `/api/suppliers`, `/api/products`, `/api/orders`, and `/api/invoices`
- **Database Foundation**: Users, auth, businesses/customers, addresses, service tiers, branches, couriers, parcels, tracking logs, payments, warehouses, products, inventory items, orders, invoices, and supplier profiles

> [!NOTE]
> **Status:** The courier/parcel tracking core is implemented and test-covered. Marketplace discovery, inventory, orders, and supplier workflows are layered around it and continue to expand.

---

## Local Development

To run LINKO locally, you will need Node.js and PostgreSQL.

### 1. Frontend Setup
Install and run the Vite dev server from the repository root:
```bash
npm install
npm run dev
```

### 2. Backend Setup
Navigate to the backend directory to install dependencies and run tests:
```bash
cd backend
npm install
npm test
```

### 3. Database Migrations & Start
Ensure you have a PostgreSQL instance running. Configure your `DATABASE_URL` (see `backend/.env.example` for reference), then run migrations and start the server:
```bash
# Apply database schemas
npm run migrate

# Start the Express server
npm start
```

---

## Documentation

Start here if you are evaluating, contributing to, or extending the project:

- **[Course Deliverable](./local-notes/course-deliverable.md)**: Checkpoint summary of the courier/parcel tracking requirements.
- **[Demo Script](./docs/DEMO_SCRIPT.md)**: Role-based live demo checklist for grading.
- **[ROADMAP.md](./ROADMAP.md)**: Explains product direction and development phases.
- **[Glossary](./docs/glossary.md)**: Defines canonical product language.
- **[API Contracts](./docs/API_CONTRACTS.md)**: Defines current frontend/backend payload expectations.
- **[Database Spec](./docs/linko_database_specification.md)**: Defines the current PostgreSQL schema.
- **[Backend Guide](./docs/BACKEND_GUIDE.md)**: Explains backend domains and build order.

---

## Development Workflow

We use `staging` as the active integration branch. 

1. Branch off `staging` for feature work.
2. Submit a Pull Request targeting `staging`.
3. Code only reaches `main` when it is ready to represent the public project.

**Project Management:**
- **[BACKLOG.md](./docs/BACKLOG.md)**: Proposed or deferred work.
- **[SPRINTS.md](./docs/SPRINTS.md)**: Committed sprint work.
- **[CONVENTIONAL_COMMITS.md](./docs/CONVENTIONAL_COMMITS.md)**: Commit message standards.

---

## Meet the Team

| Role | Name |
| :--- | :--- |
| Fullstack Developer | [@nateponds](https://github.com/nateponds) (Nathaniel Ponce) |
| Frontend Designer | [@grsm-m](https://github.com/grsm-m) (Mary Tantay) |
| Frontend Developer | [@BaelJM](https://github.com/BaelJM) (Joannah Bael) |
| Frontend Developer | [@fR3yA-ctrl](https://github.com/fR3yA-ctrl) (Freya Hermosilla) |
| Frontend Developer | [@Swashua](https://github.com/Swashua) (Joshua Faber) |

---

## License

LINKO is released under the [MIT License](./LICENSE).
