# Backlog

## Authenticated "Add a Business" Flow

Status: Proposed
Suggested by: @nateponds
Date added: 2026-07-13
Area: Frontend / Backend
Priority: Low
Related docs: `SPRINTS.md` (Sprint 9)

Description:
There is no UI path for an already-logged-in user to register a second business (of either role) onto their account. `RegisterPage.jsx` redirects any logged-in user away, so the only way a user ends up with two businesses (like the `bizswitch@linko.test` demo account) is a seed-SQL insert, never a real signup path. Consider an authenticated "add a business" flow — its own route/modal that hits a register-style endpoint without dropping the current session.

Reason:
Sprint 9 replaced the single-both-role business with a two-business model (one buyer business + one wholesaler business, switched via the Topbar switcher) as the supported way to need both capabilities. That model currently only works for seeded data; a real user cannot self-serve into it.

Expected outcome:
A logged-in user can add a second business (opposite or same role) to their account and immediately see it in the business switcher, without logging out or losing session state.

---

## Future Matching Criteria

Status: Deferred  
Suggested by: @nateponds  
Date added: 2026-06-19  
Area: Product / Backend / Frontend  
Priority: Low  
Related docs: `ROADMAP.md`, `BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`

Description:  
The MVP will match buyers and wholesalers using only location and proximity. Consider adding merchandise type, product category, quantity, pricing, reliability, fulfillment capability, and similar criteria only after the basic workflow is validated and the team confirms that their value justifies the additional data and maintenance workload.

---

## Supplier Directory & Detail Pages

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Frontend  
Priority: Medium  
Related docs: `FRONTEND_GUIDE.md`, `ROADMAP.md`

Description:  
Build the UI for wholesaler browsing, search filters, and detail views to allow buyers to find and view wholesaler capacities.

Reason:  
Supplier discovery is a core part of LINKO's value proposition for helping buyers find wholesalers.

Expected outcome:  
Users can search, filter, and view detailed wholesaler profiles with static mock data.

---

## Logistics & Shipment Coordination View

Status: Deferred (Post-MVP)  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Frontend  
Priority: Low  
Related docs: `FRONTEND_GUIDE.md`, `ROADMAP.md`

Description:  
Build the Logistics page listing shipment records, status timelines, and dispatch info.

Expected outcome:  
Warehouse/logistics staff can visually track fulfillment pipelines.

---

## User Authentication & Role-Based Access

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Backend  
Priority: High  
Related docs: `BACKEND_GUIDE.md`

Description:  
Design and implement user registration, login, and JWT-based session management, separating buyer, wholesaler, warehouse, and logistics roles.

Expected outcome:  
Users can securely log in and access domain pages tailored to their specific roles.

---

## Technical Discussion: Finance and Contract

Status: Proposed  
Suggested by: @BaelJM  
Date added: 2026-06-24  
Area: Product  
Priority: Medium  
Related docs: None

Description:
Make decisions regarding how, when, and by what method a client must pay for goods or services.

Reason:
No money, no business

Expected outcome:
Reach a conclusion that is most beneficial for all parties involved.

Notes:
Core areas to discuss include:

`Invoicing & Accounts Receivable (A/R)`
Terms are explicitly stated on every invoice to establish due dates and acceptable payment methods. Standard structures include **Net 30 (payment due in 30 days), Net 60, or Due on Receipt.**

`Sales & Procurement Contracts`
Payment terms serve as a foundational, legally binding clause within vendor agreements and sales contracts. They dictate **payment milestones** (such as progress or stage payments), **early payment discounts** (e.g., 2% 10 Net 30), and **penalties for late payments.**

`Supply Chain & Inventory`
Businesses set payment terms with suppliers (Accounts Payable) to optimize cash flow. Options here include **COD (Cash on Delivery) or PIA (Payment in Advance)** to mitigate risk.

`Credit & Risk Management`
For B2B (Business-to-Business)transactions, terms are directly tied to evaluating a buyer’s creditworthiness to ensure the seller minimizes bad debt.
**(will discuss more once approved)**

---

## Returns & Refunds Planning

Status: Deferred (was SPRINTS.md Sprint 2, retired 2026-07-10)
Suggested by: @nateponds
Date added: 2026-07-10
Area: Product / Backend
Priority: Medium
Related docs: `delivery-status-logistics.md`, `course-deliverable.md`

Description:
Planning-only work for post-shipment buyer issues: return/refund terminology, who initiates each issue, whether orders need statuses beyond `delivered`/`cancelled` (e.g. `return_requested`, `refunded`), refund ownership and invoice display, and restock behavior for returned goods. Already resolved elsewhere: failed-delivery `Returned` maps a shipped order to terminal `returned` (`delivery-status-logistics.md`); commission reversal is out — commissions/remittances are scope-frozen DB-layer-only (`course-deliverable.md`). No implementation before the remaining effects on orders, invoices, payments, inventory, and notifications are written down.

---

## Logistics Coordinator Exception Workspace

Status: Deferred (was SPRINTS.md Sprint 3, retired 2026-07-10)
Suggested by: @nateponds
Date added: 2026-07-10
Area: Frontend / Backend
Priority: Low
Related docs: `delivery-status-logistics.md`

Description:
Coordinator visibility and filters for exception parcels (returned, branchless, unassigned, stalled, manually cancelled), remarks required on coordinator/admin exceptional statuses, and showing who made each exceptional update (tracking logs do not record the acting user today — only the assigned courier). Decide whether corrections stay normal tracking rows or become audit events. Courier-side restrictions and write-scope enforcement moved to Sprints 7–8.

---

## Parcel `Cancelled` Deprecation

Status: Deferred, blocked on Returns & Refunds Planning (was SPRINTS.md Sprint 5, retired 2026-07-10)
Suggested by: @nateponds
Date added: 2026-07-10
Area: Backend
Priority: Low
Related docs: `delivery-status-logistics.md`, `LINKO_ERD.md`

Description:
Remove `Cancelled` from parcel tracking once replacement correction/refund workflows exist: inventory every reference, pick replacements (order `cancelled`, parcel `Returned`, coordinator void, future refund state), migrate the `tracking_logs.status_update` CHECK constraint, preserve historical rows. Until then it stays a coordinator/admin-only escape hatch.

---

## Release Readiness

Status: Deferred (was SPRINTS.md Sprint 6, retired 2026-07-10)
Suggested by: @nateponds
Date added: 2026-07-10
Area: Ops
Priority: Medium
Related docs: `CLAUDE.md` (branching & deployment)

Description:
Staging and production deploys are live and verified. Remaining: confirm env-var requirements per environment, confirm the migration flow against both databases, deployment-safe seed strategy (demo accounts vs production data), extend `/health` with database connectivity, safer error logging, a repeatable pre-release checklist (lint, build, migrate, backend tests), and a security-basics review (cookie flags, hashing, auth validation, role/ownership checks, secrets).

---

## Logistics UI Polish

Status: Deferred (was SPRINTS.md Sprint 4 leftovers, retired 2026-07-10)
Suggested by: @nateponds
Date added: 2026-07-10
Area: Frontend
Priority: Low
Related docs: `delivery-status-logistics.md`

Description:
Link tracking info from invoice and order views beyond the Sprint 8 buyer modal, and add empty/error states for no assigned parcels, no branch pool, and terminal parcel history. Timeline label review shipped with the delivery-status work; buyer visibility, quick-action status rules, and demo script/seeds moved to Sprint 8.

---

## Inventory Own-Product Tenant Check

Status: Deferred (Sprint 10 grilling decision, 2026-07-13)
Suggested by: @nateponds
Date added: 2026-07-13
Area: Backend
Priority: Low
Related docs: `API_CONTRACTS.md` §1.2

Description:
`POST /api/inventory` currently accepts any existing `product_id` (FK-only) —
a wholesaler may stock another business's product in their own warehouse,
which reads as consignment. The industry-standard tightening: require
`product.business_id` to also be in the caller's `memberBusinessIds`
(admins exempt), answering 404 per the anti-leak convention, plus one
rejection test. Deliberately skipped in Sprint 10 to keep the write path
minimal.

---

## Stock Count Unification Decision

Status: Deferred (frozen 2026-07-13, Sprint 10 close-out)
Suggested by: @nateponds
Date added: 2026-07-13
Area: Product / Backend / Frontend
Priority: Low
Related docs: `API_CONTRACTS.md` §1.1–1.4, `linko_database_specification.md`

Description:
The platform holds two unlinked stock numbers: `products.stock_quantity`
(single figure, drives order accept/decrement) and `inventory_items.quantity`
(per product × warehouse, trigger-audited). Sprint 10 shipped the full
inventory write contract, but no workflow consumes warehouse-level stock, so
its UI (the InventoryPage Stock tab) is frozen off behind
`SHOW_STOCK_TAB = false` for the course demo. Decide before reviving:
either make `inventory_items` the source of truth (derive
`products.stock_quantity` as SUM over warehouses) or drop the warehouse
dimension and retire contract §1.2–1.4. Until decided, do not build further
on either side.
