# LINKO — Logistics Subsystem Entity Relationship Diagram

```mermaid
erDiagram

    SERVICE_TIERS {
        INT tier_id PK
        VARCHAR tier_name
        DECIMAL base_fee "10,2"
        DECIMAL base_rate_per_kg "10,2"
        DECIMAL rate_per_km "10,2"
        INT estimated_days
    }

    ADDRESSES {
        INT address_id PK
        INT customer_id FK
        VARCHAR province
        VARCHAR city_municipality
        VARCHAR barangay
        VARCHAR street_address
        VARCHAR postal_code
    }

    CUSTOMERS {
        INT customer_id PK
        VARCHAR full_name
        VARCHAR phone_number
        VARCHAR email
        VARCHAR customer_type "individual, msme, corporation, other"
    }

    BRANCHES {
        INT branch_id PK
        VARCHAR branch_name
        INT address_id FK
        VARCHAR contact_number
    }

    COURIERS {
        INT courier_id PK
        VARCHAR full_name
        VARCHAR phone_number
        VARCHAR vehicle_type
        INT assigned_branch_id FK
    }

    PARCELS {
        VARCHAR parcel_id PK
        INT sender_id FK
        INT receiver_id FK
        INT tier_id FK
        INT origin_address_id FK
        INT destination_address_id FK
        DECIMAL weight_kg "6,2"
        VARCHAR dimensions
        DECIMAL declared_value "12,2"
        DECIMAL shipping_fee "10,2"
        DECIMAL total_distance_km "8,2"
        DATE estimated_delivery_date
    }

    PAYMENTS {
        INT payment_id PK
        VARCHAR parcel_id FK
        VARCHAR method "CHECK enum"
        VARCHAR payment_status "CHECK enum"
        DECIMAL amount "12,2"
        TIMESTAMP paid_at
    }

    COMMISSION_BRACKETS {
        INT bracket_id PK
        DECIMAL min_weight_kg "6,2"
        DECIMAL max_weight_kg "6,2"
        DECIMAL fee "10,2"
    }

    COMMISSIONS {
        INT commission_id PK
        VARCHAR parcel_id FK
        INT bracket_id FK
        DECIMAL amount "10,2"
        VARCHAR status "CHECK enum"
        TIMESTAMP settled_at
    }

    TRACKING_LOGS {
        INT log_id PK
        VARCHAR parcel_id FK
        INT branch_id FK
        INT courier_id FK
        VARCHAR status_update "CHECK enum"
        TEXT remarks
        TIMESTAMP scanned_at
    }

    CUSTOMERS ||--o{ ADDRESSES : "1 to 0..*"
    CUSTOMERS ||--o{ PARCELS : "1 to 0..* (sender)"
    CUSTOMERS ||--o{ PARCELS : "1 to 0..* (receiver)"
    ADDRESSES ||--o{ PARCELS : "1 to 0..* (origin)"
    ADDRESSES ||--o{ PARCELS : "1 to 0..* (destination)"
    ADDRESSES ||--o{ BRANCHES : "1 to 0..*"
    SERVICE_TIERS ||--o{ PARCELS : "1 to 0..*"
    PARCELS ||--|| PAYMENTS : "1 to 1 (buyer's total settlement)"
    PARCELS ||--|| COMMISSIONS : "1 to 1 (LINKO's cut from wholesaler)"
    COMMISSION_BRACKETS ||--o{ COMMISSIONS : "1 to 0..*"
    PARCELS ||--|{ TRACKING_LOGS : "1 to 1..*"
    BRANCHES |o--o{ TRACKING_LOGS : "0..1 to 0..* (nullable, line-haul)"
    BRANCHES ||--o{ COURIERS : "1 to 0..* (home base)"
    COURIERS |o--o{ TRACKING_LOGS : "0..1 to 0..* (nullable, system scans)"
```

---

## Tables

### SERVICE_TIERS

Delivery speed/pricing tiers (Standard, Express, Next-Day).

| Column           | Type          | Constraints      | Notes                                  |
| ---------------- | ------------- | ---------------- | -------------------------------------- |
| tier_id          | SERIAL        | PK               |                                        |
| tier_name        | VARCHAR(50)   | NOT NULL, UNIQUE | e.g. 'Standard', 'Express', 'Next-Day' |
| base_fee         | DECIMAL(10,2) | NOT NULL         | flat booking fee per parcel            |
| base_rate_per_kg | DECIMAL(10,2) | NOT NULL         | price per kg                           |
| rate_per_km      | DECIMAL(10,2) | NOT NULL         | price per km of journey distance       |
| estimated_days   | INT           | NOT NULL         | SLA window                             |

---

### ADDRESSES

Structured, granular address parts (Philippine hierarchy). Referenced by customers (1:N — a customer may have many addresses), branches, and parcels (origin + destination). Ownerless branch addresses leave `customer_id` null.

| Column            | Type         | Constraints              | Notes                                    |
| ----------------- | ------------ | ------------------------ | ---------------------------------------- |
| address_id        | SERIAL       | PK                       |                                          |
| customer_id       | INT          | FK → CUSTOMERS, NULLABLE | owner; null for branch addresses         |
| province          | VARCHAR(50)  | NOT NULL                 | e.g. 'Cebu'                              |
| city_municipality | VARCHAR(50)  | NOT NULL                 | e.g. 'Cebu City', 'Mandaue'              |
| barangay          | VARCHAR(50)  |                          | local district unit                      |
| street_address    | VARCHAR(150) |                          | house/lot/block no., street, subdivision |
| postal_code       | VARCHAR(10)  |                          |                                          |

---

### CUSTOMERS

Shared directory for senders and receivers. `customer_type` classifies **what kind of account it is** (individual, MSME, corporation, other) — not what it's doing in a transaction. Buy-vs-sell role is not stored here; it is read from which FK slot the customer occupies on a parcel (`sender_id` = selling, `receiver_id` = buying), so one actor can freely switch sides. Addresses live in `ADDRESSES` (1:N).

| Column        | Type         | Constraints                                                    | Notes                                                          |
| ------------- | ------------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| customer_id   | SERIAL       | PK                                                             |                                                                |
| full_name     | VARCHAR(100) | NOT NULL                                                       |                                                                |
| phone_number  | VARCHAR(20)  | NOT NULL                                                       | E.164 format                                                   |
| email         | VARCHAR(100) | UNIQUE                                                         |                                                                |
| customer_type | VARCHAR(20)  | NOT NULL, CHECK IN ('individual','msme','corporation','other') | account classification, not transaction role; role is per-parcel via FK |

---

### BRANCHES

Physical hubs/warehouses where parcels are processed. Location lives in `ADDRESSES`.

| Column         | Type         | Constraints              | Notes           |
| -------------- | ------------ | ------------------------ | --------------- |
| branch_id      | SERIAL       | PK                       |                 |
| branch_name    | VARCHAR(100) | NOT NULL, UNIQUE         | e.g. 'Cebu Hub' |
| address_id     | INT          | FK → ADDRESSES, NOT NULL | branch location |
| contact_number | VARCHAR(20)  |                          |                 |

---

### COURIERS

Riders/drivers who physically scan and move parcels, including on line-haul legs between branches.

| Column             | Type         | Constraints             | Notes                             |
| ------------------ | ------------ | ----------------------- | --------------------------------- |
| courier_id         | SERIAL       | PK                      |                                   |
| full_name          | VARCHAR(100) | NOT NULL                |                                   |
| phone_number       | VARCHAR(20)  | NOT NULL                |                                   |
| vehicle_type       | VARCHAR(30)  |                         | e.g. 'motorcycle', 'van', 'truck' |
| assigned_branch_id | INT          | FK → BRANCHES, NULLABLE | home base                         |

---

### PARCELS

Master record per package: weight, dimensions, cost, journey distance. Status and all timing live in `TRACKING_LOGS` (append-only event history).

| Column                  | Type          | Constraints                  | Notes                                                                         |
| ----------------------- | ------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| parcel_id               | VARCHAR(20)   | PK                           | alphanumeric tracking number, e.g. 'LNK-10023456'                             |
| sender_id               | INT           | FK → CUSTOMERS, NOT NULL     |                                                                               |
| receiver_id             | INT           | FK → CUSTOMERS, NOT NULL     |                                                                               |
| tier_id                 | INT           | FK → SERVICE_TIERS, NOT NULL |                                                                               |
| origin_address_id       | INT           | FK → ADDRESSES, NOT NULL     | where shipped from                                                            |
| destination_address_id  | INT           | FK → ADDRESSES, NOT NULL     | delivery address (parcel label)                                               |
| weight_kg               | DECIMAL(6,2)  | NOT NULL, CHECK > 0          |                                                                               |
| dimensions              | VARCHAR(50)   |                              | e.g. '30x30x30 cm'                                                            |
| declared_value          | DECIMAL(12,2) | NOT NULL, DEFAULT 0, CHECK ≥ 0 | goods price the buyer pays the wholesaler; 0 = undeclared. Remittance input |
| shipping_fee            | DECIMAL(10,2) | NOT NULL                     | = tier.base_fee + weight_kg × tier.base_rate_per_kg + total_distance_km × tier.rate_per_km, set by trigger |
| total_distance_km       | DECIMAL(8,2)  |                              | origin → destination journey distance, fixed at ship time; pricing input      |
| estimated_delivery_date | DATE          |                              | promised ETA, frozen at ship time (creation + tier SLA); overridable on delay |

---

### PAYMENTS

Settlement of the **buyer's total** for one parcel (1:1). `amount` is the real total cost — everything the buyer hands over: `declared_value` (goods) + `shipping_fee` (delivery), both read from the parcel at booking. Marketplace checkout / order totals still stay in the Orders/Payments domain. LINKO's per-parcel commission is settled separately in `COMMISSIONS` (payer = wholesaler, not receiver). Exists to model COD vs prepaid and the "await payment before dispatch" hold.

| Column         | Type          | Constraints                                               | Notes                                                     |
| -------------- | ------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| payment_id     | SERIAL        | PK                                                        |                                                           |
| parcel_id      | VARCHAR(20)   | FK → PARCELS, NOT NULL, UNIQUE                            | one payment per parcel (1:1)                              |
| method         | VARCHAR(20)   | NOT NULL, CHECK IN ('COD','Prepaid','Online')             | COD = collect cash on delivery                            |
| payment_status | VARCHAR(20)   | NOT NULL, CHECK IN ('Pending','Paid','Failed','Refunded') | dispatch gate: wholesaler ships only when 'Paid' (or COD) |
| amount         | DECIMAL(12,2) | NOT NULL                                                  | buyer's total = `declared_value + shipping_fee`, set by trigger |
| paid_at        | TIMESTAMP     | NULLABLE                                                  | null until settled; set when status → 'Paid'              |

---

### COMMISSION_BRACKETS

Flat commission fees by parcel weight bracket. `min_weight_kg` inclusive, `max_weight_kg` exclusive; `NULL` max = no upper cap. Brackets must cover 0 → ∞ so every parcel gets a commission.

| Column        | Type          | Constraints | Notes                       |
| ------------- | ------------- | ----------- | --------------------------- |
| bracket_id    | SERIAL        | PK          |                             |
| min_weight_kg | DECIMAL(6,2)  | NOT NULL    | inclusive lower bound       |
| max_weight_kg | DECIMAL(6,2)  | NULLABLE    | exclusive; NULL = no cap    |
| fee           | DECIMAL(10,2) | NOT NULL    | flat commission for bracket |

---

### COMMISSIONS

**LINKO's cut per parcel (1:1), charged to the wholesaler** (`Parcels.sender_id` — no duplicate payer FK stored here). Row auto-created `'Pending'` by an `AFTER INSERT` trigger on `Parcels`, which picks the weight bracket and freezes its fee into `amount` — same rationale as `shipping_fee`: future bracket changes must not rewrite what history was charged. Separate from `PAYMENTS` because the payer differs: `PAYMENTS` settles the shipping fee (receiver side), `COMMISSIONS` settles LINKO's platform fee (wholesaler side).

| Column        | Type          | Constraints                                  | Notes                                     |
| ------------- | ------------- | -------------------------------------------- | ----------------------------------------- |
| commission_id | SERIAL        | PK                                           |                                           |
| parcel_id     | VARCHAR(20)   | FK → PARCELS, NOT NULL, UNIQUE               | one commission per parcel (1:1)           |
| bracket_id    | INT           | FK → COMMISSION_BRACKETS, NOT NULL           | bracket applied at ship time              |
| amount        | DECIMAL(10,2) | NOT NULL                                     | frozen bracket fee, set by trigger        |
| status        | VARCHAR(20)   | NOT NULL, CHECK IN ('Pending','Collected'), DEFAULT 'Pending' | LINKO's collection state |
| settled_at    | TIMESTAMP     | NULLABLE                                     | null until collected                      |

---

### TRACKING_LOGS

Append-only history of every scan/status change. `scanned_at` carries per-event timing — the 'Order Created' row = creation, 'In Transit' row = dispatch, 'Delivered' row = delivery. Current status = latest row by `scanned_at`.

| Column        | Type        | Constraints               | Notes                                                                                                |
| ------------- | ----------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| log_id        | SERIAL      | PK                        |                                                                                                      |
| parcel_id     | VARCHAR(20) | FK → PARCELS, NOT NULL    |                                                                                                      |
| branch_id     | INT         | FK → BRANCHES, NULLABLE   | null = in-transit / line-haul, not at a hub                                                          |
| courier_id    | INT         | FK → COURIERS, NULLABLE   | null = automated/system scan                                                                         |
| status_update | VARCHAR(50) | NOT NULL, CHECK IN (...)  | enum: 'Order Created','Picked Up','In Transit','Out for Delivery','Delivered','Returned','Cancelled' |
| remarks       | TEXT        |                           | e.g. 'Sorted for local dispatch'                                                                     |
| scanned_at    | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP | per-event timestamp                                                                                  |

---

## Views

### WHOLESALER_REMITTANCES

Not a table — derived arithmetic. Answers "what does the wholesaler actually receive?" The buyer pays `PAYMENTS.amount` = `declared_value` (goods, to the wholesaler) **plus** `shipping_fee`; the wholesaler expects to net `declared_value − commission`, because LINKO takes its cut out of the goods payment before remitting.

| Column        | Source                                | Example (₱500 goods, ₱50 cut) |
| ------------- | ------------------------------------- | ------------------------------ |
| parcel_id     | `PARCELS.parcel_id`                   |                                |
| wholesaler_id | `PARCELS.sender_id`                   |                                |
| gross_amount  | `PARCELS.declared_value`              | 500                            |
| commission    | `COMMISSIONS.amount`                  | 50                             |
| net_amount    | `declared_value − commissions.amount` | 450                            |

Both inputs are frozen at ship time, so no drift — a view is the honest shape; a stored remittance table would duplicate them.

---

## Relationships Summary

| From          | To            | Cardinality   | Notes                                                             |
| ------------- | ------------- | ------------- | ----------------------------------------------------------------- |
| CUSTOMERS     | ADDRESSES     | 1 to 0..\*    | a customer may have many addresses                                |
| CUSTOMERS     | PARCELS       | 1 to 0..\*    | as sender (`sender_id`)                                           |
| CUSTOMERS     | PARCELS       | 1 to 0..\*    | as receiver (`receiver_id`) — two distinct FK roles to same table |
| ADDRESSES     | PARCELS       | 1 to 0..\*    | as origin (`origin_address_id`)                                   |
| ADDRESSES     | PARCELS       | 1 to 0..\*    | as destination (`destination_address_id`)                         |
| ADDRESSES     | BRANCHES      | 1 to 0..\*    | branch location                                                   |
| SERVICE_TIERS | PARCELS       | 1 to 0..\*    |                                                                   |
| PARCELS       | PAYMENTS      | 1 to 1        | one buyer payment (goods + shipping) per parcel (`parcel_id` UNIQUE) |
| PARCELS       | COMMISSIONS   | 1 to 1        | one LINKO commission per parcel, charged to sender (`parcel_id` UNIQUE) |
| COMMISSION_BRACKETS | COMMISSIONS | 1 to 0..\* | bracket applied; fee frozen into `amount`                         |
| PARCELS       | TRACKING_LOGS | 1 to 1..\*    | every parcel gets at least one log row on creation                |
| BRANCHES      | TRACKING_LOGS | 0..1 to 0..\* | nullable — line-haul scans have no branch                         |
| BRANCHES      | COURIERS      | 1 to 0..\*    | courier's home base                                               |
| COURIERS      | TRACKING_LOGS | 0..1 to 0..\* | nullable — system/automated scans have no courier                 |

---

## Design Notes / Deviations from Archived Spec

- **Status lives only in `TRACKING_LOGS`.** `Parcels` no longer carries `current_status`. Status is event data — it belongs in the append-only event log. Current status = the latest `Tracking_Logs` row by `scanned_at`. Trade-off: "where is my parcel now" needs a latest-row lookup instead of a single column read; acceptable at course scale, and normalization is the correct textbook stance.
- **Actual lifecycle timing lives in `Tracking_Logs`, not `Parcels`.** Creation, dispatch, and delivery times = the `scanned_at` of their respective status rows ('Order Created', 'In Transit', 'Delivered'). No `created_at`/`dispatched_at`/`delivered_at` columns on `Parcels` — those are event data.
- **`estimated_delivery_date` stored on `Parcels`, frozen at ship time.** Computed once at creation (creation time + tier SLA) and saved, exactly like `shipping_fee`. Deriving it live would let a future `Service_Tiers.estimated_days` change silently rewrite the promised ETA of old parcels — the same drift that justifies storing `shipping_fee`. Stored value also allows manual override when a parcel is delayed (typhoon, branch reschedule). Actual delivery time still comes from the 'Delivered' log row; this column is the _promise_, not the fact.
- **`ADDRESSES` table for granular, unified addresses.** Flat `address_line`/`city` replaced by structured parts (province, city_municipality, barangay, street_address, postal_code) following Philippine address hierarchy. Consumed by customers (1:N), branches (FK), and parcels (origin + destination FK). No many-to-many anywhere — every link is a clean 1:N per academic standard.
- **Parcels carry origin + destination address.** Both `NOT NULL` — a parcel physically comes from somewhere and goes somewhere; neither can be null. Mirrors real parcel labels (receiver name + destination address).
- **`total_distance_km` on `Parcels`.** Origin → destination journey distance is one fixed value per parcel, set at ship time — a parcel property (like weight, like cost), not an event. Belongs on the master record, not the event log. It is also a pricing input: the trigger charges `rate_per_km` per km on top of the weight component (null distance contributes zero).
- **Status kept as a `CHECK` attribute, not a lookup table.** `Tracking_Logs.status_update` is `VARCHAR` with a `CHECK IN (...)` enum. Validates values without an extra table or join, and matches how canonical LINKO models enums (`role`, `business_type`).
- **`COURIERS` added** to answer "who scanned it." A scan has an actor. `courier_id` is nullable on `TRACKING_LOGS` for automated/system events; a courier has a home `BRANCHES` base.
- **`customer_type` is account classification, not transaction role.** `CUSTOMERS.customer_type` records _what kind of account it is_ — `individual` (a person), `msme` (micro/small/medium enterprise; sari-sari stores fold in here, no separate value to avoid overlap since a sari-sari store _is_ an MSME), `corporation` (large formal business), or `other` (escape hatch, no schema change to add a stray case). Buyer/wholesaler is a _role played per transaction_, not a fixed property: the same actor sells one parcel and buys the next. That role is read from the FK slot on `PARCELS` (`sender_id` = selling side, `receiver_id` = buying side), so an account can switch sides freely with zero writes to its type. "All accounts that only ever buy" is a query (appears as `receiver_id`, never `sender_id`), not a stored column — storing a role would be a fact copied from the parcels that can drift the moment the actor switches. Mirrors the accounting _party/role_ model.
- `Parcels.parcel_id` kept as `VARCHAR(20)` natural key (human tracking number) rather than surrogate `SERIAL`, per the goal's tracking-number requirement.
- **No `total_cost` column on `Parcels` — the total lives in `PAYMENTS.amount`.** `shipping_fee` (tier base fee + weight × tier per-kg rate + distance × tier per-km rate) stays a stored column set by `BEFORE INSERT` trigger, so historical pricing survives future `Service_Tiers` rate changes; the flat `base_fee` acts as the minimum charge. `declared_value` and `shipping_fee` are the parcel's own attributes; their sum is not — it is what the buyer pays, a settlement fact, so it belongs on the payment row. Storing the sum on `Parcels` **and** an amount on `Payments` would be the redundancy; keeping it once, on `PAYMENTS.amount` (set by the same trigger that creates the payment row), removes it.
- **`PAYMENTS` settles the buyer's total.** `amount` = `declared_value + shipping_fee` — everything the buyer hands over for this parcel. `method` (COD/Prepaid/Online) tells the courier whether to collect cash on delivery; `payment_status` is the dispatch gate — the wholesaler creates the 'Picked Up' tracking log only once status is `'Paid'` (or the parcel is COD, collected at the door). "Await payment before dispatch" is therefore modeled as: payment `Pending` → no dispatch log row exists yet. Marketplace checkout and order totals remain out of scope in the Orders/Payments domain; this row is per-parcel settlement only.
- **`declared_value` on `Parcels` + `WHOLESALER_REMITTANCES` view — the money story end to end.** The buyer pays `Payments.amount` (₱550) = `declared_value` to the wholesaler (₱500) + `shipping_fee` for delivery (₱50); the wholesaler does **not** receive the full 500 — LINKO deducts its commission and remits the rest (₱450). `declared_value` is stated at booking (`DEFAULT 0` = undeclared, like real courier insurance forms); the remittance is `declared_value − commissions.amount`, exposed as a **view** rather than a stored table because both operands are already frozen at ship time — storing the difference would be duplication, not history-keeping.
- **`COMMISSIONS` — LINKO's revenue, charged to the wholesaler per parcel.** A deliberate scope addition: the platform takes a flat fee per parcel that varies by weight bracket (`COMMISSION_BRACKETS`: e.g. 0–5 kg → light fee, 5–20 kg → medium, 20+ kg → heavy). Kept as its own table, not folded into `PAYMENTS`, because the **payer differs** — the shipping fee is settled by/for the receiver side; the commission is owed by the wholesaler (`Parcels.sender_id`, role-via-FK, so no duplicate wholesaler column is stored). The row is auto-created `'Pending'` by an `AFTER INSERT` trigger on `Parcels`, and `amount` freezes the bracket fee at ship time — future bracket price changes must not rewrite what a wholesaler was historically charged (same drift argument as `shipping_fee`). The commission is _per parcel shipped_, not a percentage of sale value: goods pricing stays out of this domain.

---

## Table Count

10 tables: **Service_Tiers, Addresses, Customers, Branches, Couriers, Parcels, Payments, Commission_Brackets, Commissions, Tracking_Logs** — plus 1 view (**Wholesaler_Remittances**). Status is an attribute (`CHECK` enum), not a table. `Payments` covers the buyer's total settlement — `amount` = goods + shipping (COD / prepaid / dispatch gate); `Commissions` covers LINKO's flat per-parcel cut from the wholesaler, bracketed by weight; `declared_value` + the remittance view show what the wholesaler nets after that cut. Order totals and marketplace checkout remain out of scope in the Orders/Payments domain.
