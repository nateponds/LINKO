# Sprints

This file is used to track the team's active development cycles for LINKO. Sprint items are derived from `ROADMAP.md`, `docs/BACKLOG.md`, or approved team discussions, committing to specific deliverables for the current cycle.

---

## Sprint 2-CD: Course Deliverable Demo — Logistics (Proposed)

**Date range:** 2026-07-06 to 2026-07-13
**Sprint lead:** @nateponds
**Status:** Planned

**Goal:**
Make the CIS 2104 courier/parcel-tracking subsystem (migrations 002/003) visible in the live app for grading. Scope per `docs/course-deliverable.md`; design per `docs/LINKO_ERD.md`. No FKs to marketplace tables — the subsystem stays a decoupled bounded context.

### Tasks

- [ ] **Seed script for logistics tables**
  - **Area:** Database
  - **Notes:** Customers named after seeded businesses (demo coherence), 3 service tiers, 2–3 branches, commission brackets covering 0→∞, ~10 parcels with tracking histories.
- [ ] **Logistics API routes (`backend/src/routes/logistics.js`)**
  - **Area:** Backend / API
  - **Notes:** `GET /api/parcels`, `GET /api/parcels/:id` (detail + tracking timeline), `POST /api/parcels`, `GET /api/service-tiers`, `GET /api/customers`. Document shapes in `docs/API_CONTRACTS.md`.
- [ ] **Logistics demo UI**
  - **Area:** Frontend
  - **Notes:** Parcel list → parcel detail with tracking timeline (status derived from latest log) → book-a-parcel form (cut the form first if time squeezes). All 5 core tables visible through this flow.
- [ ] **Finals report draft (database project proposal)**
  - **Area:** Docs
  - **Notes:** Reuse `docs/LINKO_ERD.md` design notes; frame subsystems as decoupled bounded contexts; defend the Parcels-status deviation (status lives in Tracking_Logs).

---

## Sprint 2: Frontend & Backend Integration (Proposed)

**Date range:** 2026-07-06 to 2026-07-20  
**Sprint lead:** @nateponds  
**Status:** Planned  

**Goal:**  
Connect the React routed frontend with the Express + PostgreSQL backend by replacing static mock data in the UI with live API calls. Implement fully functional backend database reads/writes for inventory and suppliers, add robust body validation, and extend backend unit tests.

**Approved by:**  
- @nateponds
- @BaelJM
- Team agreement

### Tasks

#### Backend & Database Integration
- [ ] **DB-backed reads for Inventory (`GET /api/inventory`)**
  - **Owner:** @Swashua
  - **Area:** Backend / Database
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / `docs/API_CONTRACTS.md`
  - **Notes:** Query `inventory_items` joined with `products`, `categories`, and `warehouses` to return the schema format specified in API contracts.
- [ ] **DB-backed reads for Suppliers (`GET /api/suppliers`)**
  - **Owner:** @Swashua
  - **Area:** Backend / Database
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / `docs/API_CONTRACTS.md`
  - **Notes:** Query `businesses` joined with `supplier_profiles` to return supplier directories matching API contracts.
- [ ] **Request body validation middleware**
  - **Owner:** @nateponds
  - **Area:** Backend / API
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md`
  - **Notes:** Write/integrate express validation helpers to ensure correct inputs for `POST`/`PATCH` endpoints.
- [ ] **DB-backed writes for Inventory (`POST` & `PATCH`)**
  - **Owner:** @Swashua
  - **Area:** Backend / Database
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / `docs/linko_database_specification.md`
  - **Notes:** Remove 501 placeholders and implement SQL inserts/updates for `inventory_items`.
- [ ] **DB-backed writes for Suppliers (`POST` & `PATCH`)**
  - **Owner:** @Swashua
  - **Area:** Backend / Database
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / `docs/linko_database_specification.md`
  - **Notes:** Remove 501 placeholders and implement SQL inserts/updates for `supplier_profiles`.
- [ ] **Database Integration Tests**
  - **Owner:** @nateponds
  - **Area:** Backend / Testing
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md`
  - **Notes:** Write unit and integration tests inside `backend/src/app.test.js` covering successful queries, validation failures, and database errors.

#### Frontend & API Wiring
- [ ] **Wire Inventory page to Backend API**
  - **Owner:** @fR3yA-ctrl
  - **Area:** Frontend
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / [src/pages/InventoryPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/InventoryPage.jsx)
  - **Notes:** Fetch live records from `GET /api/inventory` and wire up the item creation/edit forms to trigger POST/PATCH calls. Include loading/error states.
- [ ] **Wire Supplier Discovery page to Backend API**
  - **Owner:** @BaelJM
  - **Area:** Frontend
  - **Source:** `docs/codebase-notes/CODEBASE_OVERVIEW.md` / [src/pages/SupplierDiscoveryPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/SupplierDiscoveryPage.jsx)
  - **Notes:** Fetch live directory from `GET /api/suppliers` and wire up category selection and keyword search queries to the backend.
- [ ] **Wire Become a Supplier Application to Backend API**
  - **Owner:** @BaelJM
  - **Area:** Frontend
  - **Source:** [src/pages/BecomeSupplierPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/BecomeSupplierPage.jsx)
  - **Notes:** Wire the application form submission to trigger a POST request to `/api/suppliers`.
- [ ] **Integrate Proximity-Based Matching**
  - **Owner:** @fR3yA-ctrl
  - **Area:** Frontend / Product
  - **Source:** [src/pages/MatchingPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/MatchingPage.jsx) / `ROADMAP.md`
  - **Notes:** Implement the client-side/server-side calculation to rank wholesalers by location coordinates and output proximity match reasons.

**Blockers:**  
- Setup local database container in development environments (Docker Engine needs to be run locally, or use a local raw PostgreSQL service).

**Review notes:**  
To be completed after Sprint 2 ends.

---

## Sprint 1-FE: Frontend Foundation

**Date range:** 2026-06-21 to 2026-07-05  
**Sprint lead:** @BaelJM  
**Status:** Completed  

**Goal:**  
Build the responsive app shell and core page layouts, then implement the Dashboard and Inventory views using frontend-created mock data derived from the planning documents (`docs/archived/FRONTEND_GUIDE.md`, `docs/BACKEND_GUIDE.md`).

### Tasks
- [x] **Create layout components (AppLayout, Sidebar, Topbar, MobileNav)**
  - **Owner:** @BaelJM
  - **Area:** Frontend
  - **Notes:** Responsive app shell completed. Sidebar manages navigation, Topbar handles header search, and MobileNav handles small screen tab layouts.
- [x] **Build reusable UI primitives**
  - **Owner:** @BaelJM
  - **Area:** Frontend
  - **Notes:** Shared page primitives (heading rows, search pills, table cards, and status pills) styled globally in `src/assets/css/shell.css` to keep the JSX simple. StarRating widget added under `src/components/ui/StarRating.jsx`.
- [x] **Build Dashboard page**
  - **Owner:** @fR3yA-ctrl
  - **Area:** Frontend
  - **Notes:** Implemented [src/pages/DashboardPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/DashboardPage.jsx) with widgets for revenue, orders, low-stock, and listed products, with support for toggling time ranges.
- [x] **Build Inventory page**
  - **Owner:** @fR3yA-ctrl
  - **Area:** Frontend
  - **Notes:** Implemented [src/pages/InventoryPage.jsx](file:///c:/Users/Nathaniel/Desktop/DevOps and SysAdmin DIY/LINKO/src/pages/InventoryPage.jsx) with a stock list data table, filters, low-stock status badges, edit modals, and local persistence via localStorage.

**Review notes:**  
All frontend views were successfully migrated from static HTML mocks to a routed React application. Navigation, dashboard widgets, interactive search, filters, modals, and list pages are fully functional using mock data in local storage.

---

## Sprint 1-BE: Backend Foundation

**Date range:** 2026-06-21 to 2026-07-05  
**Sprint lead:** @nateponds  
**Status:** Completed  

**Goal:**  
Select and document the backend technology stack, design the core data models and database schemas for Inventory, Suppliers, and Orders, and define the MVP location-based matching data format.

### Tasks
- [x] **Select and document Backend Stack & Database choice**
  - **Owner:** @nateponds
  - **Area:** Backend
  - **Notes:** Confirmed Express 5 + PostgreSQL. Decided schema organization and local setup, documented in `docs/BACKEND_GUIDE.md`.
- [x] **Define and document API Contracts**
  - **Owner:** @nateponds
  - **Area:** Backend / API
  - **Notes:** Defined JSON request/response contracts for `/api/inventory` and `/api/suppliers` in `docs/API_CONTRACTS.md`.
- [x] **Design core data models and schemas (TSK-03)**
  - **Owner:** @nateponds / @Swashua
  - **Area:** Full-Stack / Data Modeling
  - **Notes:** Completed ERD models and PostgreSQL schemas. Split into modular migration scripts.
- [x] **Scaffold initial backend project structure (TSK-09)**
  - **Owner:** @nateponds / @Swashua
  - **Area:** Full-Stack / Backend
  - **Notes:** Set up Express 5 API skeleton, health endpoints, mock API routes `/api/inventory` and `/api/suppliers`, custom error handler, and database pool in `backend/src/db.js`.
- [x] **Database Schema Migrations (001, 002, 003)**
  - **Owner:** @nateponds
  - **Area:** Database
  - **Notes:** Created `001_initial_schema.sql` (core tables), `002_logistics_schema.sql` (logistics/parcels tracking model), and `003_linko_schema.sql` (commissions, remittances, and service fees pricing model updates).
- [x] **Backend Testing Suite**
  - **Owner:** @nateponds
  - **Area:** Backend / Testing
  - **Notes:** Implemented tests using Node's native test runner (`node --test`), verifying healthchecks and scaffolded route statuses.

**Review notes:**  
The backend API server and PostgreSQL schemas are fully scaffolded, and the initial test suite passes on localhost. The migration runner safely applies all database modifications, and the Docker-compose staging environments have been fixed and validated as healthy on ports 8086 (frontend) and 3003 (backend).
