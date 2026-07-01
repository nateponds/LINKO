<div align="center">
  <img src="./public/images/LINKO.png" alt="LINKO" />
</div>
<br>

<div align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/nateponds/LINKO/commits/main"><img src="https://img.shields.io/github/last-commit/nateponds/LINKO/main" alt="Last Commit"></a>
  <img src="https://img.shields.io/badge/Status-In%20Development-yellow.svg" alt="Status: In Development">
</div><hr>

<h1 align="center">LINKO</h1>

LINKO is a buyer-wholesaler marketplace and operations platform for MSMEs and other businesses. It helps buyers discover reliable wholesalers, compare supply options, organize inventory work, and prepare for quote, order, and fulfillment workflows in one place.

The product is designed for small and growing businesses that need practical tools for procurement and stock visibility without taking on the complexity of a full enterprise supply-chain system. LINKO focuses on the direct buyer-wholesaler relationship: who can supply, where they can serve, how buyers can connect with them, and how those connections can become operational workflows over time.

## Product Direction

LINKO is being built around four near-term ideas:

- Wholesaler discovery for buyers looking for supply partners.
- Inventory visibility for businesses tracking products, stock levels, warehouses, and movement history.
- Proximity-based matching that starts simple and explainable.
- Deferred logistics coordination for shipment status, dispatch visibility, and fulfillment timelines.

The current scope does not model the full upstream/downstream chain. Manufacturers, distributors, retailers, and wholesalers may appear as real-world business context, but LINKO's active product model centers on buyers and wholesalers interacting through the platform.

## Codebase Snapshot

This repository contains the web application, backend scaffold, and planning documents for LINKO.

- Frontend: React 19, Vite 8, plain JSX.
- Backend: Node.js, Express 5, PostgreSQL, and a custom migration runner.
- API scaffold: `/health`, `/api/inventory`, and `/api/suppliers`.
- Database foundation: users, businesses, warehouses, products, inventory items, inventory transactions, and supplier profiles.
- Documentation: glossary, roadmap, API contracts, database specification, backend guide, layout proposal, backlog, and sprint tracking.

The project is still in active development. Some UI files are scaffolds, and several backend routes are intentionally placeholder endpoints while the team settles the product flow and data contracts.

## Local Development

Install and run the frontend from the repo root:

```bash
npm install
npm run dev
```

Run backend commands from `backend/`:

```bash
cd backend
npm install
npm test
npm start
```

Set `DATABASE_URL` before running backend migrations or starting the backend against PostgreSQL.

## Documentation

Start here if you are evaluating, contributing to, or extending the project:

- [ROADMAP.md](./ROADMAP.md) explains product direction and development phases.
- [docs/glossary.md](./docs/glossary.md) defines canonical product language.
- [docs/API_CONTRACTS.md](./docs/API_CONTRACTS.md) defines current frontend/backend payload expectations.
- [docs/LINKO_database_specification.md](./docs/LINKO_database_specification.md) defines the current PostgreSQL schema.
- [docs/BACKEND_GUIDE.md](./docs/BACKEND_GUIDE.md) explains backend domains and build order.
- [docs/PROPOSED_LAYOUT.md](./docs/PROPOSED_LAYOUT.md) captures the current frontend layout direction.

## Development Workflow

The team uses `staging` as the active integration branch. Feature work should branch from `staging`, return through pull requests, and only reach `main` when it is ready to represent the public project.

Use these project docs to keep work organized:

- [docs/BACKLOG.md](./docs/BACKLOG.md) for proposed or deferred work.
- [docs/SPRINTS.md](./docs/SPRINTS.md) for committed sprint work.
- [docs/CONVENTIONAL_COMMITS.md](./docs/CONVENTIONAL_COMMITS.md) for commit message standards.

## Team

Frontend development:

- [@BaelJM](https://github.com/BaelJM) (Bael)
- (to be added) (Tantay)

Full-stack development:

- [@nateponds](https://github.com/nateponds) (Ponce)

Backend development:

- [@Swashua](https://github.com/Swashua) (Faber)
- [@fR3yA-ctrl](https://github.com/fR3yA-ctrl) (Hermosilla)

## License

LINKO is released under the [MIT License](./LICENSE).
