# LINKO Courier & Parcel Tracking System — Use Case Diagram

This Mermaid diagram is the canonical use-case model for LINKO's current RBAC behavior. The
former PlantUML source is retained as an archived snapshot in `archived/LINKO_USE-CASE.puml`.


```mermaid
flowchart LR
%% ACTORS
Buyer["Buyer"]
Wholesaler["Wholesaler"]
Courier["Courier"]
Coordinator["Logistics Coordinator"]
Admin["Administrator"]

subgraph LINKO["LINKO Courier & Parcel Tracking System"]
UC1(("Register Parcel"))
UC2(("Calculate Shipping Fee"))
UC3(("Process Payment"))
UC4(("Track Own Parcel (via Order)"))
UC6(("Update Parcel Status"))
UC7(("Assign Courier to Branch"))
UC8(("Manage Service Tiers"))
UC9(("Manage Branches"))
UC10(("Manage Couriers"))
UC11(("Generate Tracking Number"))
UC12(("Record Tracking Log"))
UC13(("View Parcel Details"))
UC14(("Cancel Parcel"))
UC15(("Manage Users"))
UC16(("Manage Businesses"))
end

%% Buyer
Buyer --- UC4

%% Wholesaler
Wholesaler --- UC1
Wholesaler --- UC13

%% Courier
Courier --- UC6
Courier --- UC13

%% Logistics Coordinator
Coordinator --- UC1
Coordinator --- UC6
Coordinator --- UC7
Coordinator --- UC9
Coordinator --- UC10
Coordinator --- UC13
Coordinator --- UC14

%% Administrator
Admin --- UC1
Admin --- UC6
Admin --- UC7
Admin --- UC8
Admin --- UC9
Admin --- UC10
Admin --- UC13
Admin --- UC14
Admin --- UC15
Admin --- UC16

%% Includes
UC1 -.->|<<include>>| UC11
UC1 -.->|<<include>>| UC2
UC1 -.->|<<include>>| UC3
UC1 -.->|<<include>>| UC12
UC6 -.->|<<include>>| UC12
UC14 -.->|<<include>>| UC12
```

---

## Actor summary

| Actor | Use Cases |
|---|---|
| Buyer | Track Own Parcel (via Order) |
| Wholesaler | Register Parcel, View Parcel Details |
| Courier | Update Parcel Status, View Parcel Details |
| Logistics Coordinator | Register Parcel, Update Parcel Status, Assign Courier to Branch, Manage Branches, Manage Couriers, View Parcel Details, Cancel Parcel |
| Administrator | Register Parcel, Update Parcel Status, Assign Courier to Branch, Manage Service Tiers, Manage Branches, Manage Couriers, View Parcel Details, Cancel Parcel, Manage Users, Manage Businesses |

## Include relationships

| Base use case | Includes | Justification |
|---|---|---|
| Register Parcel | Generate Tracking Number | `parcel_id` is a natural key (tracking number) generated at creation |
| Register Parcel | Calculate Shipping Fee | `shipping_fee` set by trigger at insert |
| Register Parcel | Process Payment | `PAYMENTS.parcel_id` is `NOT NULL, UNIQUE` — every parcel gets a payment row |
| Register Parcel | Record Tracking Log | every parcel gets at least one log row ('Order Created') on creation |
| Update Parcel Status | Record Tracking Log | courier/coordinator status updates are written as tracking log rows |
| Cancel Parcel | Record Tracking Log | `Cancelled` is logged the same way, as a coordinator/admin override, not a courier state |

## Actor notes (mapping to the running system)

- **Register Parcel has two entry paths.** `POST /api/parcels` allows a Wholesaler, Logistics Coordinator, or Platform Administrator to create a standalone booking. A wholesaler is restricted to its active business as the parcel *Sender*; coordinators and administrators may book on behalf of a sender. An order-backed parcel is created when its wholesaler—or a platform administrator acting as an override—advances the order with `PATCH /api/orders/:id/status` and `status: "shipped"`.
- **Track Own Parcel is read-only and buyer-scoped.** `GET /api/parcels/:id` (buyer scope, API_CONTRACTS §3.6a) returns a buyer's own delivery only — no parcel list, no cross-order access.
- **Manage Service Tiers is edit-only (Sprint 12).** Update of existing tiers only; no add/delete.
- **Couriers are minted by the Administrator via Manage Users.** `POST /api/admin/users kind=courier` creates the login and the linked `couriers` row in one transaction. Coordinators only edit (PATCH) and deactivate couriers, never create them. Couriers auto-attach to the canonical LINKO Logistics org.
- **Cancel Parcel is a coordinator/admin override.** `Cancelled` is not a courier-submitted delivery state. Keeping it separate from Update Parcel Status preserves the courier's normal checkpoint and delivery flow.

## Not modeled (by design)

No use case exists for commissions or wholesaler remittances. These were an earlier self-added extra, **removed entirely in migration `018`** — no `commissions`/`commission_brackets` tables, no `wholesaler_remittances` view, and no trigger. They are not modeled and must not be reintroduced; the goods payment goes to the wholesaler undivided (`payments.amount` = `declared_value` + `shipping_fee`).

# LINKO Courier & Parcel Tracking System

### User class summary

| User Class | Frequency | Technical Expertise | Privilege Level | Relative Importance |
|---|---|---|---|---|
| Buyer | High | Low | Standard (own orders/parcels, read-only tracking) | Most important |
| Wholesaler | High | Low–Moderate | Standard (own inventory, orders, parcel registration) | Most important |
| Courier | High (bursts) | Low–Moderate | Restricted (assigned parcels, no Cancel) | Important, secondary |
| Logistics Coordinator | Moderate | Moderate | Elevated (branches, couriers, assignment, override) | Important, operational |
| Administrator | Low–Moderate | Moderate–High | Highest (full config + user/business management) | Important, low-volume |

---
