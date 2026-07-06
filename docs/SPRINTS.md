# LINKO Sprint And Milestone Plan

This file is the active delivery plan fo\n\n---

## Milestone 4: Logistics From Orders

**Status:** Implemented  
**Priority:** High  
**Goal:** Replace standalone parcel booking with shipments created from real accepted orders.

### Tasks

- [x] Remove or permanently disable standalone buyer-facing parcel booking.
- [x] Add shipment creation from accepted orders.
- [x] Link shipments to:
  - order
  - buyer business
  - wholesaler business
  - logistics coordinator
  - courier
- [x] Add logistics coordinator workflow:
  - view shipments needing assignment
  - assign courier
  - update service tier
  - update route/status
- [x] Add courier workflow:
  - view assigned shipments
  - update pickup status
  - update in-transit status
  - mark delivered
- [x] Add buyer delivery visibility through Orders and Invoices.
- [x] Keep Logistics page restricted to wholesaler, logistics coordinator, courier, and platform admin.
- [x] Add tests for shipment creation, assignment, courier access, and buyer visibility.

### Acceptance Criteria

- Shipments are created from orders, not arbitrary public forms.
- Buyers track delivery from Orders or Invoices.
- Buyers cannot open the Logistics workspace.
- Couriers see only assigned shipments.
- Logistics coordinators can coordinate shipments.
- Wholesalers can see shipment status for their fulfilled orders.

## Milestone 5: Ownership, Multi-Business Context, And Security

**Status:** Implemented  
**Priority:** High  
**Goal:** Move beyond broad role checks into correct data ownership and business context behavior.

> Verified 2026-07-06: backend suite green locally, build+lint clean.

### Tasks

- [x] Add active business context for users with multiple businesses.
- [x] Add business switcher to the app shell.
- [x] Enforce row-level ownership in backend services:
  - products
  - inventory
  - orders
  - invoices
  - shipments
  - supplier profiles
- [x] Add platform admin bypass where appropriate.
- [x] Add authorization helper tests for all ownership patterns.
- [x] Add CSRF protection or a documented same-site cookie mitigation plan. (same-site mitigation documented in docs/DEPLOYMENT.md §security)
- [x] Improve input validation across auth, products, orders, invoices, and shipments.
- [x] Add audit-friendly timestamps and created/updated metadata where missing.

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
