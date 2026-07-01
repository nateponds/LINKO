# LINKO Documentation

Reference docs for **LINKO** — a buyer-wholesaler marketplace and operations platform for MSMEs and other businesses.

For product direction and setup, start with the [root README](../README.md) and [ROADMAP](../ROADMAP.md).

## Contents

| Document | Purpose |
| --- | --- |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | Request/response JSON shapes for `/api/inventory` and `/api/suppliers`. Frontend and backend build against this contract in parallel. |
| [glossary.md](./glossary.md) | Canonical terminology — `buyer`, `wholesaler`, `supplier`, `inventory` vs `product`, and the discovery → quote → order → shipment workflow. Prefer these definitions when docs disagree. |
| [CONVENTIONAL_COMMITS.md](./CONVENTIONAL_COMMITS.md) | Commit message standard — `<type>(<scope>): <description>`. |

## Conventions

- Coordinate before changing API response shapes — `API_CONTRACTS.md` is the shared contract.
- Follow the glossary for product, API, database, and UI language.
- Commits follow Conventional Commits.
