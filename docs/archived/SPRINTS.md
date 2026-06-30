# Sprints

<!--
SPRINTS.md = things we are committing to work on now.

This file is used to track the team's active development cycles for LINKO.

Sprint items should usually come from BACKLOG.md after they have been reviewed and prioritized. Each sprint should define the current goal, timeframe, tasks, owners, blockers, and completed work.
-->

## Sprint 1-FE: Frontend Foundation

Date range: 2026-06-21 to 2026-07-05  
Sprint lead: @BaelJM  
Status: Active

Goal:  
Build the responsive app shell and core page layouts, then implement the Dashboard and Inventory views using frontend-created mock data derived from the existing planning documents (`FRONTEND_GUIDE.md`, `BACKEND_GUIDE.md`).

Approved by:

- @BaelJM
- @nateponds
- Team agreement

Tasks:

- [ ] Create layout components (AppLayout, Sidebar, Topbar, MobileNav)
  - Owner: @BaelJM
  - Area: Frontend
  - Source: FRONTEND_GUIDE.md
  - Notes: Build the responsive app shell. Sidebar for desktop navigation, Topbar for header/search, MobileNav for small screens. All pages should render inside AppLayout.

- [ ] Build reusable UI primitives (Button, Card, Badge, Input)
  - Owner: @BaelJM
  - Area: Frontend
  - Source: FRONTEND_GUIDE.md
  - Notes: Create foundational UI components that Dashboard, Inventory, and future pages will consume. Keep them simple and composable.

- [ ] Build Dashboard page
  - Owner: @fR3yA-ctrl
  - Area: Frontend
  - Source: FRONTEND_GUIDE.md
  - Notes: Overview widgets for inventory status summary, pending orders count, and supplier activity. Use frontend-created mock data based on field names from `API_CONTRACTS.md`.

- [ ] Build Inventory page
  - Owner: @fR3yA-ctrl
  - Area: Frontend
  - Source: FRONTEND_GUIDE.md
  - Notes: Stock list table (DataTable), low-stock status badges, category/status filters, and EmptyState fallback. Mock data should follow the InventoryItem fields described in `API_CONTRACTS.md`.

Blockers:

- None yet

Cross-team note:  
The frontend team will create their own mock data independently, using `API_CONTRACTS.md` as the primary reference for field names and data shapes. The backend team is designing schemas in parallel. Both teams will reconcile data shapes during the sprint review. Differences are expected to be minor since both teams are working from the same contract.

Review notes:  
To be completed after sprint review.

---

## Sprint 1-BE: Backend Foundation

Date range: 2026-06-21 to 2026-07-05  
Sprint lead: @nateponds  
Status: Active

Goal:  
Select and document the backend technology stack, design the core data models and database schemas for Inventory, Suppliers, and Orders, and define the MVP location-based matching data format for proximity matching.

Approved by:

- @nateponds
- @BaelJM
- Team agreement

Tasks:

- [x] Select and document Backend Stack & Database choice
  - Owner: @nateponds (Full-Stack)
  - Area: Backend
  - Source: BACKEND_GUIDE.md
  - Notes: Finalize the backend language/framework (e.g., Express.js) and database (e.g., PostgreSQL). Document the decision rationale, local setup instructions, and project structure expectations in `BACKEND_GUIDE.md`.

- [x] Define and document API Contracts
  - Owner: @nateponds (Full-Stack)
  - Area: Backend / API
  - Source: API_CONTRACTS.md
  - Notes: Define exact JSON schemas and payloads for the core Inventory and Supplier API endpoints to guide front-end mock development and backend implementation.

- [x] Design core data models and schemas (TSK-03)
  - Owner: @nateponds (Full-Stack) and @Swashua (Back-end Developer)
  - Area: Full-Stack / Data Modeling
  - Source: LINKO_database_specification.md
  - Notes: Define field-level schemas for User, Business, Warehouse, Category, Product, Inventory_Item, and Supplier_Profile. Output should guide PostgreSQL database migrations.

- [x] Scaffold initial backend project structure (TSK-09)
  - Owner: @nateponds (Full-Stack) / @Swashua (Back-end Developer)
  - Area: Full-Stack / Backend
  - Status: Done
  - Source: BACKEND_GUIDE.md
  - Notes: Initialized the backend project directory with the chosen stack, created placeholder route modules (`/api/inventory`, `/api/suppliers`), added basic error-handling middleware, and added the initial PostgreSQL migration.

Blockers:

- None yet

Cross-team note:  
The backend team is designing schemas independently while the frontend team creates their own mock data from the same planning documents. Both teams will reconcile data shapes during the sprint review. This gives each team freedom to focus on their core responsibilities without blocking each other.

Review notes:  
To be completed after sprint review.
