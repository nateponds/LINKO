
## Use Case Requirements — Prioritization

Prioritization uses **MoSCoW** (Must have / Should have / Could have / Won't have), justified against the ERD's structural requirements and the running system's behavior. Use cases and actors match the canonical `LINKO_USE-CASE.md` diagram.

| # | Use Case | Priority | Justification |
|---|---|---|---|
| UC1 | Register Parcel | **Must** | Core transaction entry point. `POST /api/parcels` allows wholesalers, logistics coordinators, and platform administrators; order-backed registration occurs when the responsible wholesaler, or a platform administrator override, advances an order to `shipped` through `PATCH /api/orders/:id/status`. |
| UC2 | Calculate Shipping Fee | **Must** | The parcel-insert trigger calculates `shipping_fee` from the selected service tier, measured weight, and route distance when the caller does not supply an override. |
| UC3 | Process Payment | **Must** | Both parcel-registration paths create exactly one `PAYMENTS` row in the same application transaction; `PAYMENTS.parcel_id` is unique. |
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
| — | Commissions & Wholesaler Remittances | **Won't** | Removed entirely in migration `018` — no `commissions`/`commission_brackets` tables, no `wholesaler_remittances` view, no trigger. Never a graded requirement and must not be reintroduced; the goods payment goes to the wholesaler undivided. |
| — | Returns & Refunds Handling | **Won't** | The current release models delivery returns but does not implement payment-refund or reversal workflows. |

**Rationale for the Must-tier cluster:** UC1, UC11, UC2, UC3, UC12, UC6, UC4, and UC13 form the application's parcel lifecycle — removing one leaves registration, settlement, tracking, or visibility incomplete. UC15 joins the Must tier because the fulfillment loop (UC6) has no courier or coordinator actors until an administrator provisions them. Everything in Should/Could supports operations without blocking the basic parcel lifecycle. Everything in Won't is explicitly outside the current release.

**Actors** — Buyer, Wholesaler, Courier, Logistics Coordinator, and Administrator, each mapping to an enforced RBAC role in the running system. Buyer/Wholesaler drive transaction volume (ranked most important); Courier fulfills deliveries; Coordinator runs branch/courier operations; Administrator handles low-volume platform configuration (users, businesses, service tiers).
