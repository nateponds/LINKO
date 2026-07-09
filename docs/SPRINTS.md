# LINKO Sprint Plan

This file is the active forward-looking delivery plan. Completed historical
milestones live in git history and release notes; this file should only describe
work that still needs product, design, implementation, or release attention.

---

## Sprint 1: Courier Tracking Status Semantics

**Status:** Complete
**Priority:** High
**Goal:** Keep parcel tracking statuses honest from the courier point of view.

`Cancelled` should not be a normal courier field action. Buyers cancel orders
only before shipment; after shipment, the correct language is return, refund,
failed delivery, or coordinator/admin correction.

### Tasks

- [x] Remove `Cancelled` from courier-facing status dropdowns.
- [x] Reject courier-submitted `Cancelled` tracking updates in the backend.
- [x] Keep `Cancelled` temporarily available to logistics coordinators and
      platform admins as an operational override.
- [x] Keep courier status updates forward-only:
  - `Order Created`
  - `Picked Up`
  - `In Transit`
  - `Out for Delivery`
  - `Delivered`
  - `Returned`
- [x] Treat `Delivered` and `Returned` as terminal courier outcomes.
- [x] Add or update tests proving couriers cannot:
  - backtrack to an earlier phase
  - cancel an in-flight parcel
  - change a terminal parcel status
- [x] Update parcel detail and courier dashboard UI copy where needed.
- [x] Update API, ERD, and logistics docs to mark parcel `Cancelled` as
      coordinator/admin-only and temporary.

### Acceptance Criteria

- A courier cannot select or submit `Cancelled` for a parcel.
- A courier cannot move a parcel backward in the lifecycle.
- Coordinators/admins can still correct exceptional cases.
- Tests cover both frontend status-option behavior and backend enforcement.
- Product language clearly separates order cancellation from parcel return.

---

## Sprint 2: Returns And Refunds Planning

**Status:** Planned, planning-only
**Priority:** High
**Goal:** Define what happens after shipment when the buyer cannot simply
cancel anymore.

This sprint is intentionally planning-only. The goal is to prevent rushed schema
or UI decisions around money, inventory, and delivery exceptions.

### Tasks

- [ ] Define return/refund terminology:
  - returned parcel
  - failed delivery
  - refund requested
  - refund approved
  - refund rejected
  - replacement or resend
- [ ] Decide who can initiate each post-shipment issue:
  - buyer
  - courier
  - logistics coordinator
  - wholesaler
  - platform admin
- [ ] Define how `Returned` parcel tracking affects order status.
- [ ] Decide whether orders need new statuses beyond `delivered` and
      `cancelled`, such as `return_requested` or `refunded`.
- [ ] Define refund ownership:
  - who approves
  - who pays
  - how invoices are displayed
  - whether commission is reversed
- [ ] Define inventory behavior for returned goods:
  - no restock
  - manual restock
  - automatic restock only after inspection
- [ ] Write the proposed API and schema changes before implementation.
- [ ] Add the final plan to active docs before coding begins.

### Acceptance Criteria

- The team can explain the difference between cancellation, return, and refund.
- No implementation starts until order, invoice, payment, inventory, and
  notification effects are written down.
- The plan preserves buyer-wholesaler marketplace framing.
- The plan avoids making couriers responsible for financial decisions.

---

## Sprint 3: Logistics Coordinator Exception Handling

**Status:** Planned
**Priority:** Medium
**Goal:** Give logistics coordinators a clear workspace for parcels that need
human intervention.

Coordinator work should focus on exceptions and corrections, not pretending that
couriers can resolve every operational issue from the field.

### Tasks

- [ ] Add or improve coordinator visibility for exception parcels:
  - returned
  - branchless
  - unassigned
  - stalled in one status
  - manually cancelled or voided
- [ ] Add clear coordinator/admin-only correction paths.
- [ ] Require remarks when a coordinator/admin uses exceptional statuses.
- [ ] Show who made each exceptional tracking update.
- [ ] Decide whether a correction should be a normal tracking log row or a
      separate audit event.
- [ ] Add filters for exception states on logistics pages.
- [ ] Add tests for coordinator override behavior and courier restrictions.

### Acceptance Criteria

- Couriers handle normal delivery movement.
- Coordinators handle abnormal logistics states.
- Exceptional changes are visible and auditable.
- Manual correction does not weaken courier role restrictions.

---

## Sprint 4: Delivery Visibility And Demo Polish

**Status:** Planned
**Priority:** Medium
**Goal:** Make parcel tracking understandable to buyers, wholesalers, couriers,
and reviewers.

The demo should show a clean story: buyer places order, wholesaler ships,
courier delivers or returns, and exceptional cases are handled by logistics.

### Tasks

- [ ] Update buyer order detail to explain delivery state without exposing the
      logistics workspace.
- [ ] Update invoice and order views to link tracking information clearly.
- [ ] Make courier dashboard quick actions match the same status rules as the
      parcel detail update form.
- [ ] Review timeline labels:
  - branch means handling branch
  - delivered means destination
  - returned means failed or reversed delivery path
- [ ] Add empty/error states for no assigned parcels, no branch pool, and
      terminal parcel history.
- [ ] Update demo script around:
  - pending order cancellation
  - shipped order delivery
  - returned parcel as post-shipment issue
  - coordinator/admin correction
- [ ] Update seeded demo data if needed to show one clean delivery journey and
      one exception journey.

### Acceptance Criteria

- Users do not confuse order cancellation with parcel cancellation.
- Couriers see only viable next actions.
- Buyers can understand what happened without seeing internal-only controls.
- Demo data supports the planned story without manual database edits.

---

## Sprint 5: Parcel `Cancelled` Deprecation Plan

**Status:** Planned
**Priority:** Medium
**Goal:** Remove `Cancelled` from parcel tracking entirely once replacement
workflows exist.

For now, `Cancelled` may remain in the database constraint as a temporary
admin/coordinator escape hatch. Long term, parcel tracking should use delivery
states, while order cancellation and financial reversal live in the order,
payment, refund, or support workflow.

### Tasks

- [ ] Inventory every code path, seed row, test, and doc reference to parcel
      tracking `Cancelled`.
- [ ] Decide the replacement for each use:
  - order `cancelled`
  - parcel `Returned`
  - coordinator void/correction
  - future refund state
- [ ] Write a migration plan for removing `Cancelled` from the
      `tracking_logs.status_update` check constraint.
- [ ] Decide how to preserve historical rows if any production data uses
      parcel `Cancelled`.
- [ ] Remove `Cancelled` from parcel tracking API validation after migration.
- [ ] Remove `Cancelled` from active parcel tracking docs and ERD.
- [ ] Keep order `cancelled` intact for pre-shipment cancellation/rejection.

### Acceptance Criteria

- Parcel tracking no longer has a normal `Cancelled` status.
- Order cancellation remains available before shipment.
- Historical data is either migrated or explicitly preserved.
- Tests prove couriers, coordinators, and admins use the intended replacement
  statuses.

---

## Sprint 6: Deployment And Release Readiness

**Status:** Planned
**Priority:** Medium
**Goal:** Prepare LINKO for reliable staging and production deployment.

This sprint stays last because release work should verify the product rules
above rather than race ahead of unfinished workflow decisions.

### Tasks

- [ ] Confirm environment variable requirements for frontend, backend, staging,
      and production.
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

- Keep future sprints small, reviewable, and tied to the active product model.
- Prefer backend-enforced workflow rules over frontend-only hiding.
- Do not reintroduce guest app access.
- Do not allow public registration for logistics, courier, or platform admin.
- Do not build buyer-facing standalone parcel booking.
- Keep buyer-wholesaler marketplace framing as the primary LINKO workflow.
- Treat logistics as fulfillment after an order exists.
- Treat buyer cancellation as pre-shipment order behavior.
- Treat post-shipment buyer issues as returns/refunds, not cancellation.
- Add tests when changing auth, ownership, orders, invoices, products,
  logistics, tracking status rules, or money movement.
