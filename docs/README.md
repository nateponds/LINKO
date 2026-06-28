# LINKO Documentation Review — Full Report

> **Reviewed:** June 28, 2026
> **Files Analyzed:** 24 documents across 5 directories
> **Total Documentation Size:** ~266 KB

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Document Inventory](#document-inventory)
3. [Root-Level Documents](#root-level-documents)
4. [Core Documentation (`docs/`)](#core-documentation)
5. [Extended Documentation](#extended-documentation)
6. [Archived & Example Documents](#archived--example-documents)
7. [Cross-Cutting Findings](#cross-cutting-findings)
8. [Issues & Gaps Summary](#issues--gaps-summary)
9. [Recommendations](#recommendations)

---

## Project Overview

**LINKO** (Linko Technologies, Inc.) is a supply chain management platform for MSMEs (Micro, Small, and Medium Enterprises) — primarily sari-sari stores, local franchises, and independent retailers in the Philippines. The platform centralizes supplier discovery, logistics coordination, shipment visibility, and inventory-related workflows.

- **Company:** Registered in Cebu, Philippines. 5 co-founders (academic origin — University of San Carlos, Information Management II course).
- **Tech Stack:** React 19 + Vite 8 (frontend), Node.js/Express + PostgreSQL planned (backend — not yet implemented).
- **Stage:** Design and early frontend scaffolding. Sprint 1 active (ends 2026-07-05).
- **License:** MIT

---

## Document Inventory

| # | File | Location | Size | Status |
|---|------|----------|------|--------|
| 1 | [README.md](../README.md) | Root | 2.9 KB | Active |
| 2 | [ROADMAP.md](../ROADMAP.md) | Root | 14.2 KB | Active |
| 3 | [CLAUDE.md](../CLAUDE.md) | Root | 4.3 KB | Active |
| 4 | [LICENSE](../LICENSE) | Root | 1.1 KB | Active |
| 5 | [package.json](../package.json) | Root | 629 B | Active |
| 6 | [API_CONTRACTS.md](./API_CONTRACTS.md) | docs/ | 4.1 KB | Active |
| 7 | [BACKEND_GUIDE.md](./BACKEND_GUIDE.md) | docs/ | 9.5 KB | Active |
| 8 | [BACKLOG.md](./BACKLOG.md) | docs/ | 3.0 KB | Active |
| 9 | [CONVENTIONAL_COMMITS.md](./CONVENTIONAL_COMMITS.md) | docs/ | 1.1 KB | Active |
| 10 | [LAYOUT_QUESTIONNAIRE.md](./LAYOUT_QUESTIONNAIRE.md) | docs/ | 6.4 KB | Active |
| 11 | [PROPOSED_LAYOUT.md](./PROPOSED_LAYOUT.md) | docs/ | 9.2 KB | Active |
| 12 | [SPRINTS.md](./SPRINTS.md) | docs/ | 4.7 KB | Active |
| 13 | [LINKO business plan.md](./LINKO%20business%20plan.md) | docs/ | 95.4 KB | Active |
| 14 | [beginner_backend_guide.md](./beginner_backend_guide.md) | docs/ | 15.0 KB | Active |
| 15 | [glossary.md](./glossary.md) | docs/ | 12.4 KB | Active |
| 16 | [linko_database_specification.md](./linko_database_specification.md) | docs/ | 12.3 KB | Active |
| 17 | [linko-agent-handoff.md](../local-notes/linko-agent-handoff.md) | local-notes/ | 4.2 KB | Active |
| 18 | [CODEBASE_OVERVIEW.md](./codebase-notes/CODEBASE_OVERVIEW.md) | docs/codebase-notes/ | 5.9 KB | Active |
| 19 | [FRONTEND_GUIDE.md](./archived/FRONTEND_GUIDE.md) | archived/ | 3.3 KB | Archived |
| 20 | [LINKO_BPMN_PROCESS_GUIDE.md](./archived/LINKO_BPMN_PROCESS_GUIDE.md) | archived/ | 7.2 KB | Archived |
| 21 | [archive_logistics_database_specification.md](./archived/archive_logistics_database_specification.md) | archived/ | 10.9 KB | Archived |
| 22 | [beginner_react_guide.md](./archived/beginner_react_guide.md) | archived/ | 39.8 KB | Archived |
| 23 | [EXAMPLE_BACKLOG.md](./examples/EXAMPLE_BACKLOG.md) | examples/ | 1.4 KB | Template |
| 24 | [EXAMPLE_SPRINTS.md](./examples/EXAMPLE_SPRINTS.md) | examples/ | 1.6 KB | Template |

---

## Root-Level Documents

### README.md
**Role:** Project introduction and developer onboarding hub.

- Centered logo with badges (MIT license, last commit, "In Development" status)
- One-liner: *"LINKO is a supply chain management platform for MSMEs that centralizes supplier discovery, logistics coordination, shipment visibility, and inventory-related workflows."*
- Lists 5 team members: 2 Frontend, 1 Full-Stack, 2 Backend (one TBD)
- Points to ROADMAP.md, FRONTEND_GUIDE.md, BACKEND_GUIDE.md, BACKLOG.md, SPRINTS.md

> [!WARNING]
> **No setup/install instructions** (npm install, npm run dev, etc.) — a gap for new contributors. Listed as a near-term backlog item in ROADMAP.md.

---

### ROADMAP.md
**Role:** Central strategic planning document — product vision, 11 development phases, build order, backlog, and open questions.

- **8 Core Product Domains:** Inventory, Warehouse Ops, Supplier Discovery, Supplier Matching, Orders & Fulfillment, Client Acquisition, Logistics, Analytics
- **Phases 0–4 (MVP):** Foundation → Web App → Data Modeling → Inventory/Warehouse → Supplier Directory
- **Phases 5–10:** All **deferred post-MVP** (Matching, Orders, Logistics, Auth, Mobile, Hardening)
- **MVP matching constraint:** Location/proximity only — explicitly excludes category, MOQ, lead time, price

> [!IMPORTANT]
> **6 open product questions remain unresolved:**
> 1. Which target user group to prioritize first?
> 2. What is the initial focus area?
> 3. Target market/region?
> 4. Logistics approach?
> 5. Verification process?
> 6. Location format?
>
> These would normally need resolution before Phase 1 UI decisions are finalized.

---

### CLAUDE.md
**Role:** AI-agent instruction file providing context and rules for AI assistants.

- Documents the real `src/` folder structure (components/ui, features/inventory|suppliers|matching, layouts, pages)
- Identifies 5 sources of truth: API_CONTRACTS.md, linko_database_specification.md, BACKEND_GUIDE.md, CODEBASE_OVERVIEW.md, ROADMAP.md
- Notes that `PROPOSED_LAYOUT.md` is out of date — the real layout is documented inline in CLAUDE.md
- Enforces Conventional Commits and matching MVP constraints
- Documents the backend scaffold (`backend/`) and all commands for both frontend and backend

> [!NOTE]
> **Updated June 28** to reflect the backend scaffold commit. Backend commands and `CODEBASE_OVERVIEW.md` reference added.

---

### LICENSE & package.json
- **MIT License** — Copyright 2026 LINKO Team
- **Frontend deps:** React 19 + Vite 8 only. No router, no state management, no frontend test framework.
- **Backend deps:** Express 5 + pg. Test harness is Node's built-in `node --test` (no extra packages needed).

---

## Core Documentation

### API_CONTRACTS.md
**Role:** Defines exact JSON request/response shapes for Sprint 1 frontend/backend sync.

- **Inventory:** 3 endpoints (`GET`, `POST`, `PATCH` on `/api/inventory`)
- **Suppliers:** 3 endpoints (`GET`, `POST`, `PATCH` on `/api/suppliers`)
- Nested objects in GET responses, flat IDs in POST/PATCH

> [!NOTE]
> **Gaps:** No error response shapes defined. No pagination/sorting. No DELETE endpoints. Only covers 2 of 9 domains.

---

### BACKEND_GUIDE.md
**Role:** Master backend planning document — architecture, domains, APIs, auth, matching logic.

- **9 Backend Domains** defined with capabilities
- **12 API Route Groups** sketched
- **5 User Roles:** MSME owner, Wholesaler, Warehouse staff, Logistics coordinator, Platform admin
- **Development priorities ordered** — Stack (Done) → Contracts (Done) → DB Spec (Done) → Migrations → Scaffold → Build endpoints

> [!WARNING]
> **Duplicate header bug:** Lines 1-11 contain a copy-paste duplication of the heading and purpose paragraph.

---

### BACKLOG.md
**Role:** Structured backlog of proposed/deferred work items.

- 6 items total — 3 High priority (Auth, API Scaffolding, DB Setup), 1 Medium, 2 Low/Deferred
- All items added 2026-06-19 to 2026-06-21

> [!NOTE]
> The 3 High-priority backend items overlap with Sprint 1-BE tasks but are still listed as "Proposed" rather than "In Sprint." Statuses need reconciliation.

---

### CONVENTIONAL_COMMITS.md
**Role:** Git commit message standard.

- Format: `<type>(<scope>): <description>`
- 6 types, 12 scopes, 5 examples
- Missing: `test`, `ci`, `perf`, `build`, `revert` types; `auth`, `users`, `warehouses` scopes

---

### LAYOUT_QUESTIONNAIRE.md
**Role:** 6 unresolved UI/UX design questions spawned from PROPOSED_LAYOUT.md.

> [!CAUTION]
> **All 6 answers are blank** — no team member has filled in their picks yet. This is a **blocking dependency** for finalizing the layout. The summary table is also completely empty.

Topics: Product Statistic header behavior, Supplier sidebar filtering, Category band pills, DataTable columns, Status values, Logistics page plan.

---

### PROPOSED_LAYOUT.md
**Role:** Foundational UI/UX layout proposal — page structures, component hierarchy, React folder architecture.

- **9 shared components** defined (AppHeader, SearchBar, FilterDropdown, Card, DataTable, etc.)
- **4 page layouts:** Dashboard, Inventory, Suppliers, Supplier Details
- Logistics page **explicitly excluded** — "under deliberation"
- No responsive breakpoints, CSS framework, or design tokens mentioned

---

### SPRINTS.md
**Role:** Active sprint tracker.

- **Sprint 1-FE** (Jun 21 – Jul 5): 4 tasks, Lead @BaelJM — all unchecked
- **Sprint 1-BE** (Jun 21 – Jul 5): 4 tasks, Lead @nateponds — all unchecked

> [!WARNING]
> **Sprint ends Jul 5** but all 8 tasks show unchecked, even though some backend tasks (stack selection, API contracts, DB spec) are marked "Done" in BACKEND_GUIDE.md. Checkboxes haven't been updated.

---

## Extended Documentation

### LINKO business plan.md (95 KB — largest document)
**Role:** Formal investor-facing business plan and academic deliverable.

- **5 Co-founders:** Joshua Warren Faber (CEO), Nathaniel Ryan Ponce (COO), [REDACTED] (CTO), Joannah Marie Bael (CFO), Jianna Arcilla (CMO)
- **5 Core Features:** Communication Hub, Delivery Tracking, Supplier Finder Marketplace, Automated Inventory Logging, Procurement Insights
- **Revenue Model:** Commission-based (supplier transaction commissions, featured listings, fintech referral fees)
- **3-Year Projections:** Revenue ₱1.2M → ₱3.8M → ₱7.6M; Break-even ~Month 10-12 of Year 1
- **Capital:** ₱10M authorized, ₱2.5M subscribed, ₱625K initial paid-up
- Includes: Articles of Incorporation, By-Laws, User Agreement, Resumes

> [!WARNING]
> **Financial inconsistencies found:**
> - Year 3 closing cash: ₱2,200,000 (table) vs. ₱2,350,400 (narrative) — mismatch
> - Year 3 balance sheet doesn't balance: Assets ₱4,320,000 ≠ Liabilities & Equity ₱4,996,980
> - Accrued Liabilities Year 2: "₱100,00" — likely typo for ₱100,000
> - CTO referred to as "banned-member" in one spot — suggests a team change

---

### beginner_backend_guide.md
**Role:** Hands-on Node.js/Express/PostgreSQL tutorial for beginner backend devs.

- 4 progressive exercises: Hello World → Mock API → SQL DDL → PostgreSQL connection
- Teaches parameterized queries for SQL injection prevention
- Includes MVP proximity matching logic (city-based)

> [!WARNING]
> **Outdated content:** Exercise 3 teaches `Service_Tiers` and `Parcels` tables from the old Logistics design, which has been replaced by the Inventory + Supplier schema. Also references a non-existent file `linko_database_specification_aligned_updated.md`.

---

### glossary.md
**Role:** Canonical terminology reference — standardizes language across code, APIs, DB, docs, and UI.

- Carefully distinguishes: `supplier` (umbrella) vs. `wholesaler` (preferred canonical term)
- Distinguishes: `inventory` vs. `product` vs. `inventory item` vs. `inventory transaction`
- Defines the commercial workflow: discovery → quote request → quote → order → shipment → inventory update
- 9 explicit canonical language rules

> [!TIP]
> This is one of the highest-quality documents in the project. Well-maintained and authoritative.

---

### linko_database_specification.md
**Role:** Authoritative PostgreSQL schema for Inventory & Supplier domains.

- **9 tables:** Users, Businesses, User_Businesses, Warehouses, Categories, Products, Inventory_Items, Inventory_Transactions, Supplier_Profiles
- PL/pgSQL trigger for auto-logging inventory mutations
- 3 performance indexes

> [!NOTE]
> **Design observations:**
> - `trust_rating` defaults to 5.00 (maximum) for new suppliers — potentially misleading
> - No `updated_at` columns on any table
> - No soft-delete mechanism (`is_active` / `deleted_at`)
> - Only `city` VARCHAR for location — no lat/lon or PostGIS for real distance matching

---

### linko-agent-handoff.md (local-notes/)
**Role:** Context briefing for new AI coding agents — the first file any agent should read.

- **Updated June 28** to reflect backend scaffold completion and add a running note
- Confirms: Sprint 1 active, TSK-03 and TSK-09 Done, no known blockers
- Next recommended task: build real DB logic for `GET /api/inventory` and `GET /api/suppliers`

---

### CODEBASE_OVERVIEW.md (docs/codebase-notes/)
**Role:** Living document explaining the codebase as it exists right now — intended for student developers.

- Explains the two-package structure: root Vite/React app + `backend/` Node package
- Documents the full backend request flow (server.js → app.js → routes → errorHandler)
- Lists all 9 tables created by the initial migration
- Provides a "where to build next" checklist (GET reads → validation → POST/PATCH → auth)
- **Must be updated whenever architecture changes** (per its own rules)

---

## Archived & Example Documents

### Archived Documents (4 files)

All archived docs include clear "Archive Notes" at the top explaining why they were archived and pointing to replacement documents. **This is excellent documentation hygiene.**

| Document | Reason Archived | Replaced By |
|----------|----------------|-------------|
| [FRONTEND_GUIDE.md](./archived/FRONTEND_GUIDE.md) | Superseded by more comprehensive layout strategy | PROPOSED_LAYOUT.md |
| [beginner_react_guide.md](./archived/beginner_react_guide.md) | Superseded (40KB full React course!) | PROPOSED_LAYOUT.md |
| [LINKO_BPMN_PROCESS_GUIDE.md](./archived/LINKO_BPMN_PROCESS_GUIDE.md) | Formalized to main docs folder | BPMN-process-flow.pdf |
| [archive_logistics_database_specification.md](./archived/archive_logistics_database_specification.md) | Logistics deferred to Phase 7 | Reserved for future use |

### Example Templates (2 files)

- [EXAMPLE_BACKLOG.md](./examples/EXAMPLE_BACKLOG.md) — Template for proposing backlog items
- [EXAMPLE_SPRINTS.md](./examples/EXAMPLE_SPRINTS.md) — Template for structuring sprint plans

> [!NOTE]
> Both example files reference `FRONTEND_GUIDE.md` which is now archived. Should be updated to reference current docs.

---

## Cross-Cutting Findings

### ✅ Strengths

1. **Exceptional documentation for an early-stage project** — 266KB across 24 files covering strategy, architecture, processes, tutorials, and team governance
2. **Clear archival discipline** — superseded docs are properly archived with notes pointing to replacements
3. **Strong glossary** — resolves terminology ambiguity proactively with explicit canonical rules
4. **Well-defined MVP constraints** — matching limited to location/proximity only, consistently enforced across all docs
5. **AI-agent onboarding** — CLAUDE.md and linko-agent-handoff.md ensure AI assistants understand the project quickly
6. **Sources of truth clearly identified** — API_CONTRACTS.md, linko_database_specification.md, BACKEND_GUIDE.md, CODEBASE_OVERVIEW.md, ROADMAP.md
7. **Backend scaffold committed** — Express 5 + PostgreSQL with migration runner and Node test harness now live in `backend/`

### ⚠️ Terminology Inconsistency

The terms **"supplier"** and **"wholesaler"** were used interchangeably across all documents. The June 28 terminology alignment commit (`30a6f3b`) resolved the most critical gap:
- **Glossary** prefers `wholesaler` as the canonical term ✅
- **Database migration SQL** now uses `'wholesaler'` in CHECK constraints ✅ *(resolved)*
- **Business plan** still uses "supplier" throughout — acceptable for a legal/investor document
- **API routes** use `/api/suppliers` — intentionally kept for implementation continuity per API_CONTRACTS.md note

### 📊 Status Tracking Drift

| What | BACKEND_GUIDE says | SPRINTS.md says | BACKLOG.md says |
|------|-------------------|----------------|----------------|
| Stack selection | Done ✅ | Unchecked ☐ | — |
| API contracts | Done ✅ | Checked ✅ | Proposed |
| DB spec | Done ✅ | Checked ✅ | Done ✅ *(updated Jun 28)* |
| Backend scaffold | Done ✅ | Checked ✅ | Done ✅ *(updated Jun 28)* |

> [!NOTE]
> The **Stack selection** sprint checkbox remains unchecked in SPRINTS.md despite BACKEND_GUIDE.md marking it Done. This is the only remaining status drift.

---

## Issues & Gaps Summary

### 🔴 Critical Issues

| # | Issue | Location |
|---|-------|----------|
| 1 | **Balance sheet doesn't balance** — Year 3 Assets ≠ Liabilities & Equity | Business plan |
| 2 | **All layout questionnaire answers blank** — blocking UI finalization | LAYOUT_QUESTIONNAIRE.md |
| 3 | **Stack selection sprint checkbox still unchecked** despite being Done in BACKEND_GUIDE | SPRINTS.md |

### 🟡 Moderate Issues

| # | Issue | Location |
|---|-------|----------|
| 4 | Financial figure mismatches (cash position, accrued liabilities typo) | Business plan |
| 5 | Beginner backend guide teaches archived Logistics schema | beginner_backend_guide.md |
| 6 | Broken file reference (`linko_database_specification_aligned_updated.md`) | beginner_backend_guide.md |
| 7 | Duplicate header/purpose (copy-paste error) | BACKEND_GUIDE.md |
| 8 | CTO referred to as "banned-member" (accidental disclosure) | Business plan |
| 9 | No `updated_at` columns in database schema | linko_database_specification.md |
| 10 | `trust_rating` defaults to 5.00 (max) for new suppliers | linko_database_specification.md |

### 🟢 Minor Issues

| # | Issue | Location |
|---|-------|----------|
| 11 | No setup instructions in README | README.md |
| 12 | No router library installed (`react-router-dom`) | package.json |
| 13 | No frontend test framework configured | package.json |
| 14 | Vestigial `@types/react` packages (no TypeScript used) | package.json |
| 15 | Example templates reference archived FRONTEND_GUIDE.md | examples/ |
| 16 | WSL-style paths in archived docs (inconsistent with Windows env) | archived/ |
| 17 | No error response shapes in API contracts | API_CONTRACTS.md |
| 18 | No pagination strategy for GET endpoints | API_CONTRACTS.md |
| 19 | Missing commit types (`test`, `ci`, `perf`) and scopes (`auth`, `warehouses`) | CONVENTIONAL_COMMITS.md |
| 20 | Logistics & Reports pages in nav but have no designs or contracts | PROPOSED_LAYOUT.md |
| 21 | Only `city` VARCHAR for location — no coordinates for real proximity matching | linko_database_specification.md |

---

## Recommendations

### Immediate (This Sprint)

1. **Update SPRINTS.md checkboxes** to reflect actual progress — backend tasks like stack selection, API contracts, and DB spec appear to be done
2. **Reconcile BACKLOG.md statuses** — items that moved to Sprint 1 should be marked "In Sprint"
3. **Complete the Layout Questionnaire** — this is blocking frontend finalization

### Short-Term (Next Sprint)

4. **Add setup instructions to README** (`npm install`, `npm run dev`, environment requirements)
5. **Fix beginner_backend_guide.md** — update Exercise 3 to use current Inventory/Supplier schema, fix broken file link
6. **Fix BACKEND_GUIDE.md** duplicate header
7. **Add `updated_at` columns** to database schema (standard practice)
8. **Review `trust_rating` default** — consider defaulting to NULL or 0 instead of 5.00
9. **Update example templates** to reference current docs instead of archived FRONTEND_GUIDE.md

### Medium-Term

10. **Fix business plan financials** — balance sheet discrepancy, cash flow narrative mismatch, accrued liabilities typo
11. **Define error response shapes** in API_CONTRACTS.md
12. **Add pagination strategy** for GET endpoints
13. **Plan geographic coordinates** — add lat/lon to Businesses/Warehouses for real proximity matching
14. **Install react-router-dom** when multi-page navigation begins
15. **Harmonize "supplier" vs. "wholesaler"** terminology in code (CHECK constraints, route names)
