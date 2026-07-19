
## Use Case Requirements — Prioritization

Prioritization uses **MoSCoW** (Must have / Should have / Could have / Won't have), justified against the ERD's structural requirements (what the schema forces to exist) versus its explicit scope decisions (what was deliberately deferred). Use cases and actors match `LINKO_USE-CASE.puml` / `LINKO_USE-CASE.md`.

| # | Use Case | Priority | Justification |
|---|---|---|---|
| UC1 | Register Parcel | **Must** | Core transaction entry point, performed by the shipping **Wholesaler** (`POST /api/parcels`, `orders/:id/ship` = `R:wholesaler`); every other parcel record (payment, tracking log) spawns from this action. |
| UC2 | Calculate Shipping Fee | **Must** | `shipping_fee` is `NOT NULL` and trigger-set at insert; the system cannot register a parcel without computing it. |
| UC3 | Process Payment | **Must** | `PAYMENTS.parcel_id` is `NOT NULL, UNIQUE` — every parcel requires a settlement record. |
| UC4 | Track Own Parcel (via Order) | **Must** | The product's core value proposition (visibility); read-only, buyer-scoped to their own orders (`GET /api/parcels/:id`). |
| UC6 | Update Parcel Status | **Must** | Without courier/coordinator-submitted scans, `TRACKING_LOGS` never advances past creation — the core fulfillment loop breaks. |
| UC7 | Assign Courier to Branch | **Should** | Maintains `COURIERS.assigned_branch_id`; important for operations but overlaps with Manage Couriers and could be folded into it. |
| UC8 | Manage Service Tiers | **Could** | Tiers can be seeded once at launch (Standard/Express/Next-Day) and rarely change; Sprint 12 limits this to edit-only. An admin UI is a convenience, not a launch blocker. |
| UC9 | Manage Branches | **Should** | Required for `TRACKING_LOGS.branch_id` and courier home bases to resolve meaningfully, but changes infrequently once seeded. |
| UC10 | Manage Couriers | **Should** | Needed to maintain the workforce that fulfills UC6, but is a back-office setup task, not a per-transaction one. |
| UC11 | Generate Tracking Number | **Must** | Every registered parcel must be assigned a unique tracking number before it can be identified throughout the system. Satisfies the ERD's primary-key requirement. |
| UC12 | Record Tracking Log | **Must** | Every parcel gets at least one log row on creation (`PARCELS 1 to 1..* TRACKING_LOGS`); status has no other home in the schema. |
| UC13 | View Parcel Details | **Must** | Shared dependency of tracking and history views; needed by wholesaler, courier, coordinator, and admin. |
| UC14 | Cancel Parcel | **Should** | Explicitly required by the schema (`Cancelled` is a defined enum value with its own handling rules) but is an exception path, not a core flow; a coordinator/admin override. |
| UC15 | Manage Users | **Must** | The only path that mints courier and coordinator logins (`POST /api/admin/users`). Without it there are no couriers to fulfill UC6 and no coordinators to run operations. |
| UC16 | Manage Businesses | **Should** | Business verification toggle (`PATCH /api/admin/businesses/:id`); operationally useful for trust signalling but does not block the parcel lifecycle. |
| — | Commission Management / Collection UI | **Won't** | Explicit scope freeze in the ERD: *"no application workflow (collection, reversal, UI) will be built."* Commission rows are system-generated only. |
| — | Wholesaler Remittance UI | **Won't** | `WHOLESALER_REMITTANCES` is documented as a **view**, not a workflow — reporting/report material only, per the same scope freeze. |
| — | Returns & Refunds Handling | **Won't** | Explicitly deferred per the ERD (`docs/BACKLOG.md` "Returns & Refunds Planning") — reversal semantics are out of scope for this deliverable. |

**Rationale for the Must-tier cluster:** UC1, UC11, UC2, UC3, UC12, UC6, UC4, and UC13 form a closed loop — none can be removed without breaking a `NOT NULL`/trigger constraint or leaving a core actor without their one essential function. UC15 joins the Must tier because the fulfillment loop (UC6) has no actors until couriers and coordinators are provisioned through it. Everything in Should/Could is operationally necessary but does not block the basic parcel lifecycle from functioning. Everything in Won't is explicitly out of scope per the ERD's own scope-freeze notes, not an oversight.

**Actors** — Buyer, Wholesaler, Courier, Logistics Coordinator, and Administrator, each mapping to an enforced RBAC role in the running system. Buyer/Wholesaler drive transaction volume (ranked most important); Courier fulfills deliveries; Coordinator runs branch/courier operations; Administrator handles low-volume platform configuration (users, businesses, service tiers).
