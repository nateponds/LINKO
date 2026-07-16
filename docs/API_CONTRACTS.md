# API Contracts Spec

## Context: Sprint 1 Frontend/Backend Sync Contract

---

## 1. Inventory Domain — removed

The warehouse-level inventory subsystem (`/api/inventory`, `inventory_items`,
`inventory_transactions`) was phased out in migration `019`. The app never
adopted it: stock is tracked as `products.stock_quantity` and edited through
`/api/products` (§2b). See that section for the shipped stock CRUD.

---

## 2. Supplier Domain (`/api/suppliers`)

Note: the route name remains `suppliers` for implementation continuity, but in product language this domain primarily represents wholesaler-facing marketplace profiles.

> **Milestone 2 reconciliation.** The Sprint 1 sketch below (nested `supplier_profiles` shape, `POST`/`PATCH`) has been replaced by a real, read-only listing. The `POST`/`PATCH` supplier-registration endpoints and the `supplier_profiles`-nested payload are **not implemented**; suppliers are derived from `businesses` where `business_type = 'wholesaler'`. Any authenticated user may read. See §2.1 for the shipped shape.

### 2.1 `GET /api/suppliers` (shipped, Milestone 2)

List businesses acting as wholesalers, each with a count of their active products. Any authenticated user.

**Query Parameters (Optional):**

- `q`: ILIKE match on `business_name`
- `category_id`: only suppliers having ≥1 active product in that category (EXISTS)

**Response Body (`200 OK`):**

```json
[
  {
    "business_id": 2,
    "business_name": "Harbor Bulk Trading",
    "city": "Mandaue",
    "address_line": "88 Portside Ave",
    "is_verified": true,
    "product_count": 12
  }
]
```

`POST /api/suppliers` and `PATCH /api/suppliers/:id` are not implemented in Milestone 2 (business/wholesaler registration happens through `/api/auth/register`).

---

## 2b. Product & Category Domain (`/api/products`, `/api/categories`) — Milestone 2

All endpoints require authentication (`401` unauthenticated). `stock_status` is derived, never stored: `out_of_stock` when `stock_quantity = 0`, `low_stock` at 1–10, `in_stock` above 10. `unit_price` is a decimal string (`NUMERIC(12,2)`).

**Product JSON shape (returned everywhere):**

```json
{
  "product_id": 1,
  "business_id": 2,
  "business_name": "Harbor Bulk Trading",
  "product_name": "Jasmine Rice 25kg",
  "sku": "RICE-25",
  "description": "...",
  "category_id": 3,
  "category_name": "Grains",
  "unit_price": "1250.00",
  "stock_quantity": 40,
  "stock_status": "in_stock",
  "image_url": "https://...",
  "created_at": "..."
}
```

### 2b.1 `GET /api/categories`

Any authenticated user. Ordered by name.

```json
[{ "category_id": 1, "category_name": "Bakery" }]
```

### 2b.2 `GET /api/products`

Any authenticated user. Returns only `is_active = TRUE` products, ordered by `product_name`.

**Query Parameters (all optional, combinable):** `business_id` (int), `category_id` (int), `q` (ILIKE on `product_name`).

### 2b.3 `GET /api/products/:id`

Any authenticated user. `404` if missing or inactive.

### 2b.4 `POST /api/products`

Roles: `wholesaler` or `platform_admin`.

**Body:** `product_name` (required, non-empty, ≤100), `unit_price` (required, number ≥ 0), `sku?` (≤50), `description?`, `category_id?`, `stock_quantity?` (int ≥ 0, default 0), `image_url?`.

Owning `business_id` comes from the caller's `wholesaler` membership: 0 memberships and not admin → `403`; more than 1 → `400` ("multiple wholesaler businesses not supported yet"). A `platform_admin` with no wholesaler membership **must** pass `business_id` in the body; it is validated to exist with `business_type = 'wholesaler'`, else `400`. Duplicate `sku` → `400`. Returns `201` + the created product (full shape).

### 2b.5 `PATCH /api/products/:id`

Roles: `wholesaler` (own product only) or `platform_admin` (any). Partial update of the POST fields (not `business_id`). Not owner → `403`. Missing/inactive → `404`. Returns the updated product.

### 2b.6 `DELETE /api/products/:id`

Same auth/ownership as PATCH. Soft delete (`is_active = FALSE`). `204`. Already inactive/missing → `404`.

---

## 2c. Orders & Invoices Domain (`/api/orders`, `/api/invoices`) — Milestone 3

All endpoints require authentication (`401` unauthenticated). Roles: `buyer`, `wholesaler`, or `platform_admin`; logistics/courier-only users receive `403`.

Order status lifecycle is server-enforced:

`pending → accepted | cancelled`, `accepted → preparing`, `preparing → shipped`, `shipped → delivered | returned`.

Invalid skips/backwards transitions return `400`. Buyers may cancel only their own pending orders. Wholesalers may accept/reject and advance only incoming orders for their business **up to `shipped`**. The terminal `delivered` and `returned` outcomes are tracking-driven: an authorized `Delivered` or `Returned` scan on the linked parcel performs the corresponding order transition (see §3.6). Wholesalers requesting either outcome get `403`. Platform admins can view all orders and invoices and may perform either valid transition as a manual override; a manual `returned` override notifies both businesses with generic failed-delivery wording.

**Order JSON shape:**

```json
{
  "order_id": 1,
  "buyer_business_id": 1,
  "buyer_business_name": "Sunrise Retail Cooperative",
  "wholesaler_business_id": 2,
  "wholesaler_business_name": "Harbor Bulk Trading",
  "status": "pending",
  "total": "351.00",
  "created_at": "2026-07-05T12:00:00.000Z",
  "updated_at": "2026-07-05T12:00:00.000Z",
  "items": [
    {
      "order_item_id": 1,
      "product_id": 10,
      "product_name": "Premium Pork Belly 5kg",
      "sku": "HBT-PORK-01",
      "quantity": 2,
      "unit_price_snapshot": "150.50",
      "line_total": "301.00"
    }
  ],
  "invoice": null
}
```

`total`, `unit_price_snapshot`, and `line_total` are decimal strings from PostgreSQL `NUMERIC`.

### 2c.1 `GET /api/orders`

Returns visible orders:

- buyers: orders for their buyer business
- wholesalers: incoming orders for their wholesaler business
- platform admins: all orders

```json
[
  {
    "order_id": 1,
    "buyer_business_name": "Sunrise Retail Cooperative",
    "wholesaler_business_name": "Harbor Bulk Trading",
    "status": "accepted",
    "parcel_id": "LKO-00000001",
    "total": "240.00",
    "items": [],
    "invoice": {
      "invoice_id": 1,
      "invoice_number": "INV-1-1783253000000",
      "total": "240.00",
      "issued_at": "2026-07-05T12:05:00.000Z"
    }
  }
]
```

`parcel_id` (Sprint 8) is the order's auto-created parcel, or `null` before the order ships. It backs the buyer's "Track parcel" modal, which then reads the parcel via `GET /api/parcels/:id` (§3.6a). Exposed on both `GET /api/orders` (what the Orders UI consumes) and `GET /api/orders/:id`.

### 2c.2 `GET /api/orders/:id`

Returns one visible order (same shape as the list rows above, including `parcel_id`). Missing, non-numeric, or not-owned orders return `404`.

### 2c.3 `POST /api/orders`

Role: `buyer` (or platform admin with explicit `buyer_business_id`).

Owning `buyer_business_id` comes from the caller's buyer membership: 0 memberships → `403`; more than 1 → `400` ("multiple buyer businesses not supported yet"). Order items must reference active products, all from one wholesaler business. Product prices are snapshotted into `order_items.unit_price_snapshot` when the order is created. Stock is not decremented until acceptance.

**Body:**

```json
{
  "items": [
    { "product_id": 10, "quantity": 2 },
    { "product_id": 11, "quantity": 1 }
  ]
}
```

Returns `201` + the created order.

### 2c.4 `PATCH /api/orders/:id/status`

Roles: `buyer`, `wholesaler`, or `platform_admin` (admin acts as a manual override for stuck/legacy orders).

**Body:**

```json
{ "status": "accepted" }
```

```json
{ "status": "shipped", "weight_kg": 8.5, "dimensions": "40x30x20 cm" }
```

Accepting an order decrements each product's `stock_quantity` in the same transaction and generates exactly one invoice. If any line lacks enough stock, the request returns `400` and neither stock nor invoices change. Rejecting an order uses status `cancelled`.

Marking an order `shipped` **requires** `weight_kg` (a number > 0; missing or non-positive → `400`) and accepts optional `dimensions` — the wholesaler records the real parcel weight at the physical handoff, so the shipping fee is set from a true measurement (Sprint 8). Shipping auto-creates a parcel (with `order_id` set, migration 009) plus its payment row and an `'Order Created'` tracking log; the parcel then appears in the courier pickup pool (§3.1). Checkout never measured a route, so `total_distance_km` is `NULL` and the ETA derives from the service tier's `estimated_days` (not a fixed `+5`). This bridge snapshots the frozen order-item subtotal into `parcels.declared_value` and keeps the tier's quoted `base_fee` as `parcels.shipping_fee` ("fee quoted at checkout, weight recorded at handoff"). The auto-created payment is `Online` and settles as `'Paid'` at ship time (§3.3). Standalone `POST /api/parcels` bookings continue to use the full weight-and-distance shipping formula.

Returns the updated order.

### 2c.5 `GET /api/invoices`

Returns visible invoices:

- buyers: invoices for their buyer business
- wholesalers: invoices for their fulfilled orders
- platform admins: all invoices

```json
[
  {
    "invoice_id": 1,
    "invoice_number": "INV-1-1783253000000",
    "order_id": 1,
    "order_status": "accepted",
    "buyer_business_id": 1,
    "buyer_business_name": "Sunrise Retail Cooperative",
    "wholesaler_business_id": 2,
    "wholesaler_business_name": "Harbor Bulk Trading",
    "total": "240.00",
    "issued_at": "2026-07-05T12:05:00.000Z",
    "items": []
  }
]
```

### 2c.6 `GET /api/invoices/:id`

Returns one visible invoice with item rows. Missing, non-numeric, or not-owned invoices return `404`.

---

## 3. Logistics Domain (course deliverable — Sprint 2-CD)

Exposes the CIS 2104 courier subsystem (migrations 002/003) for the demo UI. Money and measurement fields are JSON numbers. `current_status` is always derived from the latest `tracking_logs` row, never stored on the parcel (see `docs/LINKO_ERD.md`). Since migration 009 a parcel may carry a nullable `order_id` linking it to the marketplace order that spawned it — a deliberate, documented boundary crossing.

### 3.1 `GET /api/parcels`

List parcels with derived current status, most recently scanned first. Row visibility by role: coordinators/admins see all; wholesalers see parcels their businesses send or receive; couriers see parcels they have handled plus the unassigned pickup pool for their assigned handling branch (latest log has no courier and its `branch_id` matches the courier's `assigned_branch_id`, including NULL-to-NULL for branchless couriers).

**Response Body (`200 OK`):**

```json
[
  {
    "parcel_id": "LKO-0005",
    "sender": { "business_id": 5, "full_name": "Fishy Friends" },
    "receiver": { "business_id": 7, "full_name": "Marielle Ocampo" },
    "tier_name": "Express",
    "weight_kg": 6.2,
    "shipping_fee": 318.15,
    "estimated_delivery_date": "2026-07-04",
    "current_status": "Out for Delivery",
    "last_scanned_at": "2026-07-05T09:47:21.662Z",
    "failed_attempts": 0
  }
]
```

`failed_attempts` is the derived count of `'Delivery Failed'` tracking rows for the parcel (never stored on the parcel row); the courier dashboard uses it to gate the retry vs return-leg actions.

### 3.2 `GET /api/parcels/:id`

Parcel detail with full tracking timeline (oldest first). `404` if unknown. `branch_name` on each tracking history row is the dispatch/handling branch for that event. The UI should not treat it as a literal physical "at this hub" location for every status.

**Response Body (`200 OK`):**

```json
{
  "parcel_id": "LKO-0001",
  "sender": { "business_id": 1, "full_name": "John's Pork", "phone_number": "0917-555-0101" },
  "receiver": { "business_id": 7, "full_name": "Marielle Ocampo", "phone_number": "0918-555-0107" },
  "tier": { "tier_id": 2, "tier_name": "Express", "estimated_days": 2 },
  "origin_address": {
    "province": "Cebu",
    "city_municipality": "Cebu City",
    "barangay": "Mabolo",
    "street_address": "12 Pork Ave",
    "postal_code": "6000"
  },
  "destination_address": {
    "province": "Cebu",
    "city_municipality": "Cebu City",
    "barangay": "Lahug",
    "street_address": "Unit 4B, Gorordo Ave",
    "postal_code": "6000"
  },
  "weight_kg": 3.5,
  "dimensions": "40x30x20 cm",
  "declared_value": 2450,
  "shipping_fee": 235.9,
  "total_distance_km": 12.4,
  "estimated_delivery_date": "2026-07-01",
  "payment": { "method": "Prepaid", "payment_status": "Paid", "amount": 2685.9, "paid_at": "2026-06-26T15:47:21.662Z" },
  "current_status": "Delivered",
  "latest_courier_id": 1,
  "latest_branch_id": 1,
  "tracking_history": [
    {
      "status_update": "Order Created",
      "branch_name": "Cebu Hub",
      "courier_name": null,
      "remarks": "Booking confirmed",
      "scanned_at": "2026-06-26T15:47:21.662Z"
    }
  ]
}
```

### 3.3 `POST /api/parcels`

Book a parcel. The database fills `shipping_fee` (tier pricing trigger) and `payments.amount` (goods + shipping). Also writes the first `'Order Created'` tracking log. `payment_status` is **method-honest**: `Prepaid` / `Online` insert as `'Paid'` with `paid_at` set at booking; `COD` starts `'Pending'` and settles later on the terminal tracking scan (§3.6). The payment→dispatch gate is modeled, not enforced (course-deliverable scope).

**Request Body:**

```json
{
  "sender_id": 1,
  "receiver_id": 7,
  "tier_id": 1,
  "origin_address_id": 1,
  "destination_address_id": 7,
  "weight_kg": 2.5,
  "dimensions": "30x20x15 cm",
  "declared_value": 1000,
  "total_distance_km": 10,
  "payment_method": "COD"
}
```

`dimensions`, `declared_value` (defaults 0), and `total_distance_km` are optional. `payment_method` ∈ `COD | Prepaid | Online`. Missing fields / bad references → `400`.

New parcels are stamped into the pickup pool for the origin city: `origin_address.city_municipality` is matched case-insensitively against branch address city; no match leaves `branch_id = NULL` for manual coordinator assignment.

**Response Body (`201 Created`):**

```json
{
  "parcel_id": "LKO-73912645",
  "shipping_fee": 115,
  "declared_value": 1000,
  "estimated_delivery_date": "2026-07-10",
  "current_status": "Order Created"
}
```

### 3.4 `GET /api/service-tiers`

```json
[
  { "tier_id": 1, "tier_name": "Standard", "base_fee": 45, "base_rate_per_kg": 20, "rate_per_km": 2, "estimated_days": 5 }
]
```

### 3.5 (removed)

`GET /api/businesses` was deleted with the standalone booking surface (Sprint 8); it fed only the retired book-a-parcel form. Section number retained so later references (§3.6) stay stable.

### 3.6 `POST /api/parcels/:id/tracking`

Roles: `courier`, `logistics_coordinator`, `platform_admin`. Appends a tracking scan; the parcel's `current_status` becomes this scan.

**Request Body:**

```json
{ "status_update": "Picked Up", "remarks": "optional", "branch_id": null, "courier_id": null }
```

`status_update` is one of `Order Created | Picked Up | Arrived at Branch | Departed Branch | Out for Delivery | Delivery Failed | Out for Return | Delivered | Returned | Cancelled`; anything else returns `400`. (`In Transit` was removed in migration 020; `Out for Return` was added in migration 021.) For courier-role callers, `Cancelled` is rejected with `400` because cancellation is not a normal field delivery outcome. `Cancelled` remains temporarily available only to logistics coordinators and platform admins as an operational correction.

Courier identity is server-side: a courier caller's scan is stamped with their own linked `couriers.user_id` row and assigned handling branch, and any body `courier_id` / `branch_id` is ignored (a courier without a linked row gets `403`). Admin "create courier user" inserts the linked `couriers` row in the same transaction as the user account, so this link always exists for newly provisioned couriers. Coordinators/admins may pass an explicit `courier_id` and `branch_id` (or none). If no branch is supplied, the API carries forward the latest non-null branch for that parcel; if no courier is supplied by a coordinator/admin, the scan deliberately unassigns the parcel back to that branch pool. A courier's first scan on a pool parcel (`Picked Up`) is the claim that assigns it to them.

Courier-role updates follow an explicit **transition map** (migration 020 — the flow is non-linear, so the old forward-only integer rank is gone):

```
Order Created     → Picked Up
Picked Up         → Arrived at Branch | Out for Delivery
Arrived at Branch → Departed Branch | Out for Delivery       (fail count < 3)
Departed Branch   → Arrived at Branch | Out for Delivery
Out for Delivery  → Delivered | Delivery Failed
Delivery Failed   → Out for Delivery      (fail count < 3)   [retry]
                  → Arrived at Branch     (fail count >= 3)  [locked return leg]
Arrived at Branch → Out for Return        (fail count >= 3; only move)
Out for Return    → Returned              (fail count >= 3; only move)
Delivered / Returned / Cancelled → terminal
```

The fail count is derived from `tracking_logs` (never stored on `parcels`) and gates the transition; it never auto-writes `Returned`. After the 3rd fail, the parcel enters a one-way path: branch arrival, `Out for Return`, then physical handoff to the sender as `Returned`. Direct `Arrived at Branch → Returned`, redelivery, and hub departure are invalid on the return leg. A courier cannot submit `Cancelled` and cannot append any update after `Delivered` or `Returned`; a move not on an edge returns `400`. Coordinators/admins follow the same movement map and retain `Cancelled` as their operational correction.

**Automatic terminal proof:** for courier callers, `Delivered` generates `courier full_name → receiver business_name`; `Returned` generates `courier full_name → sender business_name`. Any client-sent courier remarks on those terminal scans are replaced. `Arrived at Branch` generates `Arrived at {branches.branch_name}` and `Departed Branch` generates `Departed from {branches.branch_name}`, using the scan's resolved `branch_id`. `Out for Return` is non-terminal and carries the fixed one-tap movement remark. `Delivery Failed` carries a canned failure reason. Coordinators and platform admins retain manual remarks on every status, including the branch checkpoints.

**Payment settlement (Sprint 8):** a scan on a parcel whose payment is `COD` and still `Pending` settles inside the same transaction — `Delivered → payment_status 'Paid'` (with `paid_at`), `Returned → 'Failed'`. The update is guarded on `Pending`, so a coordinator correction after a terminal scan never rewrites an already-settled payment. Non-COD payments already settled at booking (§3.3). The payment→dispatch gate remains modeled, not enforced.

Side effects on a parcel with an `order_id` are transactional and apply to courier, coordinator, and admin tracking updates. A `Delivered` scan flips a linked order from `shipped` to terminal `delivered` and notifies the buyer ("Order Delivered"). The return flow is split: the 3rd `Delivery Failed` warns both businesses with no order/payment change; `Arrived at Branch` and `Out for Return` are movement only; the final `Returned` scan flips a linked order from `shipped` to `returned`, fails pending COD, and notifies only the wholesaler with `Parcel Returned to You`. If the linked order is not `shipped`, the order update and notification are skipped.

**Response Body (`201 Created`):** the inserted `tracking_logs` row.

### 3.6a Buyer read scope on `GET /api/parcels/:id`

`GET /api/parcels/:id` gains a **buyer** scope (Sprint 8): a buyer may read a single parcel when its `receiver_id` is one of their buyer businesses — this backs the read-only "Track parcel" modal on the Orders screen. As with every other role, an out-of-scope parcel returns **404** (existence is not leaked), and the internal `sender_id` / `receiver_id` fields are stripped from the response.

The parcel **list** (`GET /api/parcels`) stays **operator-only**: a buyer-only caller receives an empty list — buyers can never enumerate parcels, only read their own delivery by id. The tracking **write** route (§3.6) is unchanged and still excludes `buyer`. (Sprint 9 dropped the `both` business type; a single business can no longer be both buyer and wholesaler. A user who holds both roles does so via two distinct businesses, and only the active business's roles apply to a given request.)
