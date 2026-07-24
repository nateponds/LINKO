# LINKO Sprint Plan

This file is the active forward-looking delivery plan. Completed historical  
milestones live in git history and release notes; this file should only describe  
work that still needs product, design, implementation, or release attention.

---

### Completed Sprints

**Sprint 7: Logistics Correctness & Authz** (Done)  
Closed correctness and authorization holes in the logistics tracking system, including replacing timestamp IDs with safe sequences, enforcing courier read/write scope rules, introducing row-level database locks for claims, and fully implementing soft-delete semantics for reference data.

**Sprint 8: Logistics Workflow Integrity & Buyer Visibility** (Done)  
Ensured end-to-end honesty in the demo workflow by recording actual parcel weights at shipment, progressing payment statuses based on method, enforcing proof-of-delivery remarks, and adding a read-only tracking modal for buyers. The dead standalone booking UI was removed.

**Sprint 9: Phase Out the Both-Role Combination** (Done)  
Eliminated the overlapping "both" role (buyer + wholesaler) to ensure strict separation. Added unique role-per-business constraints, updated the registration flow, and adapted seed data to showcase the top-bar multi-business switching feature instead. (Supersedes the Sprint 8 Follow-up).

**Sprint 11: Parcel Cancellation Workflow** (Done)  
Implemented a backend-enforced admin/coordinator `Cancelled` tracking operation that correctly cascades to cancel the underlying marketplace order and fail pending COD payments, complete with necessary notifications.

**Sprint 12: Editable Service Tier Pricing (PUT-only)** (Done)  
Provided platform admins with a secure UI and endpoint to edit service tier rates, ensuring via database triggers that historical parcels retain their frozen original shipping fee.

---

## Active Sprint

### Sprint 13: Location Routing & Map Integration (Contracts landed; implementation pending)

Add geolocation to the logistics subsystem: coordinates on `addresses`, one canonical
logistics location per business (buyer = delivery, wholesaler = pickup), Haversine
nearest-available-branch auto-assignment replacing the naive city match, server-computed
pricing distance (client `total_distance_km` removed), immutable planned-route snapshots
per parcel, a business location Settings surface, branch coordinate/availability
management, and a shared Mapbox map picker. Course-graded scope: Branches is a graded
core table, and branch/courier refinement was confirmed graded 2026-07-17.

Design decisions are recorded in `docs/LOCATION_ROUTING.md`; API shapes in
`docs/API_CONTRACTS.md` (§2c.3, §2c.4, §3.2, §3.3, §3.7, §5). Missing-coordinate policy
is **block-until-pinned** at each actor's earliest touchpoint (order placement for
buyers, ship for wholesalers, booking for standalone parcels) — no NULL-distance
grandfathering; the project is pre-launch and seeded data is disposable.

Commit sequence (each independently buildable/testable):

1. `docs(location): define routing contracts` — this entry, decision record, API contracts, README pre-launch notice
2. `feat(location): define canonical business locations` — migration 023 finalized in place (coords + CHECKs, `is_available`, `logistics_address_id`, `parcel_route_stops`), seed geometry, registration pointer
3. `feat(location): validate coordinate pairs` — pure shared validator + unit tests
4. `feat(logistics): resolve nearest available branch` — shared resolver replacing both `findBranchIdByCity` copies
5. `feat(logistics): route standalone parcel bookings` — ownership validation, pin gate, resolver, server distance, snapshot
6. `feat(orders): gate and route marketplace shipments` — buyer gate at placement, wholesaler gate at ship, canonical addresses, rollback
7. `feat(logistics): snapshot late branch assignments` — snapshot hook in the tracking-write transaction
8. `feat(branches): manage locations and availability` — GET/POST coords, new PATCH, availability
9. `feat(ui): manage branch locations` — route guard fix, edit UI, availability-first affordance
10. `feat(settings): manage business logistics location` — GET/PUT settings, `has_coordinates` in session memberships
11. `feat(ui): add location settings and reminder` — Settings page, AppLayout banner
12. `feat(map): add shared location picker` — Mapbox GL + geocoder, `MapPicker`, fallback
13. `feat(logistics): show planned parcel route` — `planned_route` API + read-only map
14. `fix(logistics): send active business on parcel list` — shared API helper on LogisticsPage

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
