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

---

## Product Direction

LINKO is being built around four near-term pillars:

1. **Wholesaler Discovery**: Helping buyers looking for supply partners.
2. **Inventory Visibility**: Tools for businesses tracking products, stock levels, warehouses, and movement history.
3. **Proximity-Based Matching**: Starts simple, local, and explainable.
4. **Deferred Logistics Coordination**: Shipment status, dispatch visibility, and fulfillment timelines.

*(Note: The current scope focuses exclusively on direct buyer-wholesaler interactions. We do not model the full upstream/downstream manufacturer or distributor chains yet).*

---

## Codebase Snapshot

This repository contains the web application, backend scaffold, and planning documents for LINKO. 

**Tech Stack & Architecture**
- **Frontend**: React 19, Vite 8, plain JSX
- **Backend**: Node.js, Express 5, PostgreSQL, and a custom migration runner
- **API Scaffold**: `/health`, `/api/inventory`, and `/api/suppliers`
- **Database Foundation**: Users, auth, businesses, warehouses, products, inventory items, orders, invoices, full logistics (parcels/tracking), commissions, and supplier profiles

> [!NOTE]
> **Status:** The project is in active development. Some UI files are scaffolds, and several backend routes are intentionally placeholder endpoints while the team finalizes product flow and data contracts.

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

| Frontend | Full-Stack | Backend |
| :--- | :--- | :--- |
| [@BaelJM](https://github.com/BaelJM) (Bael) | [@nateponds](https://github.com/nateponds) (Ponce) | [@Swashua](https://github.com/Swashua) (Faber) |
| [@grsm-m](https://github.com/grsm-m) (Tantay) | | [@fR3yA-ctrl](https://github.com/fR3yA-ctrl) (Hermosilla) |

---

## License

LINKO is released under the [MIT License](./LICENSE).
