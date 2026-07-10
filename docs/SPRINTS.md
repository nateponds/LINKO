# LINKO Sprint Plan

This file is the active forward-looking delivery plan. Completed historical
milestones live in git history and release notes; this file should only describe
work that still needs product, design, implementation, or release attention.

---

<!-- Sprint numbering is stable: numbers are never reused. Sprint 1 (courier
     tracking status semantics) completed and lives in git history. Sprints 2-6
     were never committed and were compressed into docs/BACKLOG.md entries on
     2026-07-10 (returns planning, coordinator exceptions, Cancelled
     deprecation, release readiness, logistics UI polish) — this file holds
     committed work only. -->

## Sprint 7: Logistics Correctness & Authz

**Status:** Done
**Priority:** High
**Goal:** Close the correctness and authorization holes in the graded parcel
tracking subsystem found by the 2026-07-10 logistics audit.

These are defects, not features: booking IDs that collide by design, a courier
write path that ignores the read-side visibility rules, an unlocked claim race,
and soft-delete semantics (migration 015) that can strand live parcels.

### Tasks

- [x] Replace timestamp-derived parcel IDs (`LKO-` + `Date.now()` slice, wraps
      every ~28h → PK collision → user-facing 400) with a Postgres sequence:
      `'LKO-' || lpad(nextval, 8, '0')`. One shared helper replaces both
      generation sites (`routes/logistics.js` booking, `routes/orders.js`
      ship-time auto-create).
- [x] Enforce courier write scope on `POST /api/parcels/:id/tracking`: a
      courier may scan only parcels in their handling history or the
      unassigned pool of their assigned branch — the same rule as read
      visibility. Out of scope → `404` (matches read-side anti-leak
      behavior). Handoffs keep going through coordinator unassign
      (`docs/delivery-status-logistics.md` decision 5).
- [x] Lock the parcel (`SELECT … FOR UPDATE`) inside the tracking-scan
      transaction so the pool-claim race and the forward-only status check are
      serialized (two couriers can currently both claim the same parcel).
- [x] Finish soft-delete semantics (015):
  - Block branch deactivation while non-terminal unassigned parcels sit in its
    pool: `409` with the live-parcel count; reassign first.
  - Filter `is_active` in `parcelScope` and the courier stamp lookup so a
    deactivated courier loses list/scan access immediately.
  - Validate coordinator-supplied `branch_id` / `courier_id` (and courier
    creation's `assigned_branch_id`) against active rows.
  - Replace the `branch_name` UNIQUE constraint with a partial unique index
    `WHERE is_active` so a deactivated branch's name can be reused.
- [x] Add missing constraints/indexes: unique partial index on
      `couriers.user_id`, index on `tracking_logs(courier_id)` (courier scope
      runs an EXISTS against it per parcel).
- [x] Localize Logistics Management delete errors — a failed delete currently
      replaces the whole page with the error text.
- [x] Tests: cross-branch courier scan rejected, concurrent claim yields one
      winner, branch delete blocked while pool is live, deactivated courier
      gets `403`, sequential parcel IDs never collide.

### Acceptance Criteria

- A courier cannot write to any parcel they cannot see.
- Booking and shipping never fail from parcel-ID collision.
- Deactivating reference data never strands an in-flight parcel and never
  leaves a hidden actor with API access.
- Every rule above is backend-enforced and test-covered (per execution rules).

---

## Sprint 8: Logistics Workflow Integrity & Buyer Visibility

**Status:** Done
**Priority:** High
**Goal:** Make the graded demo path honest end to end — real weights, moving
payment status, evidence-bearing terminal scans, and delivery visibility for
the buyer — and delete the dead booking surface.

Depends on nothing in Sprint 7; the two ship as separate reviewable PRs.

### Tasks

- [x] Ship-time weight entry: the wholesaler provides `weight_kg` (and optional
      `dimensions`) when marking an order `shipped` — replaces the hardcoded
      10.0 kg / 15.0 km placeholders, so the commission bracket freezes from a
      real weight. `shipping_fee` stays the frozen checkout quote (per commit
      `ce24e68`; defend in report as "fee quoted at checkout, weight recorded
      at handoff"). Distance becomes `NULL`; ETA derives from the tier's
      `estimated_days`, not `CURRENT_DATE + 5`.
- [x] Method-honest payment lifecycle (gate stays unenforced per
      `docs/course-deliverable.md`): `Prepaid`/`Online` → `Paid` + `paid_at`
      at booking; `COD` → `Paid` on the `Delivered` scan, `Failed` on
      `Returned`. All inside the existing transactions.
- [x] Remarks-as-POD: courier `Delivered` and `Returned` scans require
      non-empty remarks (`400` otherwise) — "Received by <name>" / failure
      reason. Parcel detail labels the field per selected status; courier
      dashboard quick actions for those two statuses prompt for remarks
      instead of sending a canned string (absorbs Sprint 4's "quick actions
      match status rules" task). Signature/photo POD and attempt/retry cycles
      stay deferred with RMA.
- [x] Buyer tracking modal (absorbs Sprint 4's buyer-visibility task): buyers
      get a read-only tracking view for their own deliveries without entering
      the logistics workspace — no Logistics nav, no parcel list.
  - `GET /api/orders/:id` exposes `parcel_id` (LEFT JOIN parcels).
  - `GET /api/parcels/:id` gains a buyer scope: visible when `receiver_id`
    is one of the caller's buyer businesses. List stays operator-only; the
    tracking write route is untouched.
  - Orders UI: "Track parcel" on shipped/delivered/returned orders opens a
    modal rendering the tracking timeline (reuse the parcel-detail timeline
    pieces).
- [x] Delete the dead standalone booking surface: `BookParcelPage.jsx`
      (unrouted, calls the removed `/api/customers`), the `/logistics/book`
      redirect, `GET /api/businesses` (feeds nothing else), and API_CONTRACTS
      §3.5. `POST /api/parcels` stays as the API-level demo of the pricing/
      commission triggers.
- [x] Update the demo script and seed data for one clean delivery journey and
      one failed-delivery journey, exercising the new surface end to end:
      ship-time weight entry, payment status transitions, POD remarks, buyer
      tracking modal, coordinator correction (salvaged from retired Sprint 4).
- [x] Update docs: API_CONTRACTS (§3.6 POD rule + buyer scope, orders
      `parcel_id`, §3.5 removal) and delivery-status-logistics.md (courier
      write scope, POD, payment lifecycle, buyer modal).
- [x] Tests: buyer sees own parcel via its order and `404`s on others';
      remarks enforcement on terminal courier scans; payment transitions per
      method; shipped order carries the entered weight.

### Acceptance Criteria

- The marketplace demo path (the only live booking path) shows real recorded
  weight, a payment status that moves, and terminal scans that carry evidence.
- A buyer can answer "where is my order?" from the order screen alone, and
  cannot reach operator surfaces.
- No dead logistics code or stale contract sections remain.
- Demo data supports the planned story without manual database edits.

---

## Sprint 8 Follow-up: Mixed-Role Active Business Context

**Status:** Planned
**Priority:** High
**Goal:** Make business selection and mixed-role authorization consistent across
the frontend and API without reopening the completed Sprint 8 delivery scope.

Implementation decisions and acceptance details are fixed in
[`SPRINT_8_ACTIVE_BUSINESS_GUIDE.md`](./SPRINT_8_ACTIVE_BUSINESS_GUIDE.md).
This is committed follow-up work, not backlog work.

### Tasks

- [ ] Resolve active context by unique business, with all memberships for the
      selected business active together.
- [ ] Align the switcher, route guards, API scoping, and parcel-list behavior
      with the guide.
- [ ] Persist and restore the last valid business selection, then clear stale
      data and refresh when the user switches businesses.
- [ ] Correct the Sprint 8 demo script's role-switching misconception and add
      mixed-role/multi-business verification steps.
- [ ] Add backend and frontend tests for the guide's selection, capability,
      redirect, and isolation rules.

### Acceptance Criteria

- The active selector chooses a business, never one membership role within it.
- A selected business receives the additive capabilities of all its roles;
  memberships belonging to other businesses remain inactive.
- Multi-business requests cannot silently fall back to an arbitrary business.
- Switching businesses cannot leave data or navigation from the previous
  context on screen.
- The demo script describes and demonstrates the implemented model accurately.

---

## Execution Rules

- Keep future sprints small, reviewable, and tied to the active product model.
- Prefer backend-enforced workflow rules over frontend-only hiding.
- Do not reintroduce guest app access.
- Do not allow public registration for logistics, courier, or platform admin.
- Do not build buyer-facing standalone parcel booking.
- Buyers get read-only delivery visibility scoped to their own orders (Sprint 8
  modal); never logistics workspace access or a similar account surface to
  courier/coordinator dashboards.
- Keep buyer-wholesaler marketplace framing as the primary LINKO workflow.
- Treat logistics as fulfillment after an order exists.
- Treat buyer cancellation as pre-shipment order behavior.
- Treat post-shipment buyer issues as returns/refunds, not cancellation.
- Add tests when changing auth, ownership, orders, invoices, products,
  logistics, tracking status rules, or money movement.
