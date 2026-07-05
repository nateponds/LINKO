# LINKO Sprint And Milestone Plan

This file is the active delivery plan for LINKO. It replaces the older mock-data integration sprint with the current product direction:

- LINKO must require real authentication before users can access the app.
- LINKO must use role-based access control for buyer, wholesaler, logistics, courier, and platform admin workflows.
- Marketplace products must be owned by registered businesses, not hardcoded frontend data.
- Logistics must be created from orders and shipments, not from a public standalone parcel booking form.
- Buyer-facing delivery visibility belongs in Orders and Invoices, not in the Logistics staff workspace.

## Current Direction

LINKO is being developed as a buyer-wholesaler marketplace and operations platform. The immediate goal is to move from a portfolio-style demo into a course-deliverable application with credible users, businesses, authentication, permissions, database-backed workflows, and end-to-end marketplace behavior.

## Roles

- `buyer`: can browse and buy supplies, manage buyer-side orders and invoices, and track deliveries through order/invoice views.
- `wholesaler`: can manage a wholesaler business, list products, receive orders, and coordinate fulfillment.
- `logistics_coordinator`: can manage shipments and delivery coordination.
- `courier`: can view and update assigned shipment progress.
- `platform_admin`: can manage the platform, users, businesses, and all operational data.

Public self-registration is allowed only for buyer and wholesaler owner accounts. Logistics, courier, and platform admin accounts must be seeded or created by an admin.

---

## Milestone 1: Authentication And RBAC

**Status:** In progress  
**Priority:** Critical  
**Goal:** Remove guest/demo access and make LINKO a real logged-in application with backend-enforced authorization.

### Completed Or Implemented

- [x] Add PostgreSQL-backed cookie sessions.
- [x] Add `linko_session` session cookie.
- [x] Store only hashed session tokens in the database.
- [x] Add password hashing with Node `crypto.scrypt`.
- [x] Add auth/RBAC migration:
  - `business_memberships`
  - `auth_sessions`
  - auth fields on `users`
  - global platform admin role support
- [x] Add seeded demo accounts:
  - `buyer@linko.test`
  - `wholesaler@linko.test`
  - `logistics@linko.test`
  - `courier@linko.test`
  - `admin@linko.test`
- [x] Add backend auth routes:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- [x] Protect backend APIs with authentication and role checks.
- [x] Block unauthenticated Logistics access.
- [x] Block buyer access to Logistics.
- [x] Add frontend auth provider.
- [x] Add protected frontend routes.
- [x] Add real Login page.
- [x] Add real Register page.
- [x] Add role-aware navigation.
- [x] Add logout.
- [x] Redirect `/logistics/book` away for now.
- [x] Add backend tests for auth, sessions, protected APIs, and logistics authorization.

### Remaining

- [x] Restart local backend so the new auth routes are live on `localhost:5000`.
- [x] Run migrations against the active local PostgreSQL database.
- [x] Start Vite frontend on `localhost:5173`.
- [x] Manually verify:
  - logged-out `/logistics` redirects to `/login`
  - `logistics@linko.test` can open Logistics
  - `buyer@linko.test` cannot open Logistics
  - buyer can open Dashboard, Orders, Invoices, Inventory, and marketplace pages
  - logout returns to Login
- [x] Backend-level verification passed 2026-07-05: migrations clean, 26/26 tests pass, live API checks confirm 401 unauthenticated, buyer 403 on /api/parcels, logistics 200, logout invalidates session. Browser walkthrough still pending.
- [x] Commit the Milestone 1 auth/RBAC changes (commit `53b0ddc`).

### Acceptance Criteria

- No protected app route is visible while logged out.
- Backend APIs return `401` when unauthenticated.
- Backend APIs return `403` when authenticated with the wrong role.
- Login/register/logout work through the browser.
- Seeded role accounts work.
- Buyer cannot use Logistics.
- Logistics coordinator can use Logistics.
- Existing build, lint, and backend tests pass.

---

## Milestone 2: Database-Backed Marketplace Products

**Status:** Implemented — browser walkthrough pending  
**Priority:** Critical  
**Goal:** Replace hardcoded merchandise with real products owned and managed by registered wholesaler businesses.

### Tasks

- [x] Review existing product, inventory, business, and supplier schema coverage.
- [x] Add or update product tables as needed:
  - products
  - categories
  - business-owned listings
  - prices
  - stock status
  - product images or image URLs
- [x] Add wholesaler product APIs:
  - `GET /api/products`
  - `GET /api/products/:id`
  - `POST /api/products`
  - `PATCH /api/products/:id`
  - `DELETE /api/products/:id` or soft-delete equivalent
- [x] Enforce ownership:
  - wholesaler sees and edits only their own products
  - platform admin can see and edit all products
- [x] Replace frontend hardcoded merchandise with API data.
- [x] Add product management UI for wholesaler businesses.
- [x] Add buyer-facing marketplace browsing from database-backed products.
- [x] Add empty, loading, and error states.
- [x] Add backend tests for product ownership and role checks.
- [x] Verified 2026-07-05: live API smoke 23/23 checks pass (buyer browse/403, wholesaler CRUD lifecycle, admin rules); backend tests pass; lint + build clean. Review fixes applied: sku partial-unique index for soft-delete reuse, numeric :id validation, ownership-gated row actions. Known deferred: MatchingPage still uses mock supplier slugs (links to profiles show empty state) — migrate with Matching work; admin has no Add-product business picker.

### Acceptance Criteria

- Marketplace products come from PostgreSQL, not hardcoded arrays.
- Wholesaler can create and edit products for their business.
- Buyer can browse products.
- Buyer cannot create wholesaler listings.
- Unauthenticated users cannot browse the app.
- Product APIs are covered by tests.

---

## Milestone 3: Orders And Invoices

**Status:** Planned  
**Priority:** Critical  
**Goal:** Turn product browsing into a real purchase workflow.

### Tasks

- [ ] Define order lifecycle:
  - pending
  - accepted
  - preparing
  - shipped
  - delivered
  - cancelled
- [ ] Add order tables or update existing order schema.
- [ ] Add order item rows tied to products.
- [ ] Add order APIs:
  - buyer creates order
  - buyer views own orders
  - wholesaler views incoming orders
  - wholesaler accepts or rejects order
  - wholesaler updates order preparation status
  - platform admin views all orders
- [ ] Add invoice generation from accepted orders.
- [ ] Add invoice APIs:
  - buyer views own invoices
  - wholesaler views invoices for their orders
  - platform admin views all invoices
- [ ] Update frontend Orders page to use real data.
- [ ] Update frontend Invoices page to use real data.
- [ ] Add order creation flow from product purchase.
- [ ] Add tests for order ownership, invoice ownership, and role checks.

### Acceptance Criteria

- Buyer can place an order from a real product.
- Wholesaler can see and manage incoming orders.
- Buyer can see order and invoice status.
- Invoices are tied to real orders.
- Users cannot access orders or invoices they do not own, except platform admin.

---

## Milestone 4: Logistics From Orders

**Status:** Planned  
**Priority:** High  
**Goal:** Replace standalone parcel booking with shipments created from real accepted orders.

### Tasks

- [ ] Remove or permanently disable standalone buyer-facing parcel booking.
- [ ] Add shipment creation from accepted orders.
- [ ] Link shipments to:
  - order
  - buyer business
  - wholesaler business
  - logistics coordinator
  - courier
- [ ] Add logistics coordinator workflow:
  - view shipments needing assignment
  - assign courier
  - update service tier
  - update route/status
- [ ] Add courier workflow:
  - view assigned shipments
  - update pickup status
  - update in-transit status
  - mark delivered
- [ ] Add buyer delivery visibility through Orders and Invoices.
- [ ] Keep Logistics page restricted to wholesaler, logistics coordinator, courier, and platform admin.
- [ ] Add tests for shipment creation, assignment, courier access, and buyer visibility.

### Acceptance Criteria

- Shipments are created from orders, not arbitrary public forms.
- Buyers track delivery from Orders or Invoices.
- Buyers cannot open the Logistics workspace.
- Couriers see only assigned shipments.
- Logistics coordinators can coordinate shipments.
- Wholesalers can see shipment status for their fulfilled orders.

---

## Milestone 5: Ownership, Multi-Business Context, And Security

**Status:** Planned  
**Priority:** High  
**Goal:** Move beyond broad role checks into correct data ownership and business context behavior.

### Tasks

- [ ] Add active business context for users with multiple businesses.
- [ ] Add business switcher to the app shell.
- [ ] Enforce row-level ownership in backend services:
  - products
  - inventory
  - orders
  - invoices
  - shipments
  - supplier profiles
- [ ] Add platform admin bypass where appropriate.
- [ ] Add authorization helper tests for all ownership patterns.
- [ ] Add CSRF protection or a documented same-site cookie mitigation plan.
- [ ] Improve input validation across auth, products, orders, invoices, and shipments.
- [ ] Add audit-friendly timestamps and created/updated metadata where missing.

### Acceptance Criteria

- A user with multiple businesses can choose which business they are acting as.
- Users cannot access another business's private data.
- Platform admin access is intentional and tested.
- Authorization rules are centralized enough to maintain safely.

---

## Milestone 6: Admin, Demo Readiness, And Course Polish

**Status:** Planned  
**Priority:** Medium  
**Goal:** Make LINKO credible for professor review, demo walkthroughs, and team grading.

### Tasks

- [ ] Add platform admin dashboard.
- [ ] Add admin user management:
  - list users
  - create logistics/courier/admin users
  - deactivate users
  - view business memberships
- [ ] Add admin business management:
  - list businesses
  - inspect business owners
  - manage verification/status fields if needed
- [ ] Add seed/reset demo data script for consistent grading demos.
- [ ] Add clear demo account documentation.
- [ ] Improve empty states across the app.
- [ ] Improve user-facing error messages.
- [ ] Remove or label remaining mock/demo-only data.
- [ ] Prepare a professor demo script:
  - buyer journey
  - wholesaler journey
  - logistics coordinator journey
  - courier journey
  - platform admin journey

### Acceptance Criteria

- The app demonstrates real accounts, businesses, orders, invoices, and logistics.
- Demo data can be reset consistently.
- Professor can see authentication and RBAC clearly.
- Remaining unfinished areas are intentionally scoped, not accidental.

---

## Milestone 7: Deployment And Production Readiness

**Status:** Planned  
**Priority:** Medium  
**Goal:** Prepare LINKO for reliable staging and production deployment.

### Tasks

- [ ] Confirm environment variable requirements for frontend, backend, staging, and production.
- [ ] Confirm staging and production database migration flow.
- [ ] Add deployment-safe seed strategy.
- [ ] Verify staging deployment:
  - frontend on port `8086`
  - backend on port `3003`
  - staging Postgres on port `5433`
- [ ] Verify production deployment:
  - frontend on port `8085`
  - backend on port `3002`
  - production Postgres on port `5432`
- [ ] Add health checks for backend and database connectivity.
- [ ] Add safer error logging.
- [ ] Add final lint, build, migration, and backend test checklist.
- [ ] Review security basics:
  - session cookie flags
  - password hashing
  - auth route validation
  - role checks
  - ownership checks
  - production secrets

### Acceptance Criteria

- Staging deploy works end to end.
- Production deploy works end to end.
- Migrations can be applied safely.
- Demo accounts and production data strategy are separated.
- Final verification checklist is documented and repeatable.

---

## Execution Rules

- Keep implementation milestones small and reviewable.
- Prefer backend-enforced authorization over frontend-only hiding.
- Do not reintroduce guest app access.
- Do not allow public registration for logistics, courier, or platform admin.
- Do not build buyer-facing standalone parcel booking.
- Do not hardcode marketplace products once Milestone 2 starts.
- Keep buyer-wholesaler marketplace framing as the primary LINKO workflow.
- Treat logistics as fulfillment after an order exists.
- Add tests when changing auth, ownership, order, invoice, product, or logistics behavior.
