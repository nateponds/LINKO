# API Contracts Spec

## Context: Sprint 1 Frontend/Backend Sync Contract

---

## 1. Inventory Domain (`/api/inventory`)

### 1.1 `GET /api/inventory`

Fetch all inventory items with basic product and warehouse details.

**Query Parameters (Optional):**

- `warehouse_id`: filter by warehouse
- `category_id`: filter by category

**Response Header:** `Content-Type: application/json`

**Response Body (`200 OK`):**

```json
[
  {
    "item_id": 1,
    "product": {
      "product_id": 101,
      "product_name": "Premium Industrial Valves",
      "sku": "VALVE-500X",
      "category": {
        "category_id": 3,
        "category_name": "Plumbing & Piping"
      },
      "description": "Standard heavy-duty steel valves"
    },
    "warehouse": {
      "warehouse_id": 5,
      "warehouse_name": "Manila Sortation Center",
      "city": "Manila"
    },
    "quantity": 150,
    "unit": "pcs",
    "reorder_threshold": 20,
    "status": "In Stock",
    "created_at": "2026-06-21T04:00:00Z"
  }
]
```

### 1.2 `POST /api/inventory`

Add product stock at a specific warehouse location.

**Request Header:** `Content-Type: application/json`

**Request Body:**

```json
{
  "product_id": 101,
  "warehouse_id": 5,
  "quantity": 100,
  "unit": "pcs",
  "reorder_threshold": 15
}
```

**Response Body (`201 Created`):**

```json
{
  "item_id": 2,
  "product_id": 101,
  "warehouse_id": 5,
  "quantity": 100,
  "unit": "pcs",
  "reorder_threshold": 15,
  "created_at": "2026-06-21T04:41:00Z"
}
```

### 1.3 `PATCH /api/inventory/:id`

Modify stock count, reorder limits, or units.

**Request Body:**

```json
{
  "quantity": 120,
  "reorder_threshold": 25
}
```

**Response Body (`200 OK`):**

```json
{
  "item_id": 2,
  "product_id": 101,
  "warehouse_id": 5,
  "quantity": 120,
  "unit": "pcs",
  "reorder_threshold": 25,
  "updated_at": "2026-06-21T04:42:00Z"
}
```

---

## 2. Supplier Domain (`/api/suppliers`)

Note: the route name remains `suppliers` for implementation continuity, but in product language this domain primarily represents wholesaler-facing marketplace profiles.

### 2.1 `GET /api/suppliers`

List wholesalers matching search keywords or category filters.

**Query Parameters (Optional):**

- `city`: filter by location
- `category_id`: filter by product categories

**Response Body (`200 OK`):**

```json
[
  {
    "supplier_id": 201,
    "business_name": "Apex Wholesale Tools",
    "contact_number": "+639171234567",
    "address_line": "12 Building Blocks St",
    "city": "Manila",
    "is_verified": true,
    "profile": {
      "minimum_order_quantity": 50.00,
      "lead_time_days": 5,
      "delivery_terms": "FOB Manila Hub",
      "trust_rating": 4.80,
      "verification_status": "verified"
    }
  }
]
```

### 2.2 `POST /api/suppliers`

Register a business as a wholesaler.

**Request Body:**

```json
{
  "business_name": "Global Metalworks Ltd",
  "contact_number": "+639177654321",
  "address_line": "Industrial Zone B",
  "city": "Cebu",
  "minimum_order_quantity": 100.00,
  "lead_time_days": 10,
  "delivery_terms": "CIF Cebu Port"
}
```

**Response Body (`201 Created`):**

```json
{
  "supplier_id": 202,
  "business_name": "Global Metalworks Ltd",
  "contact_number": "+639177654321",
  "address_line": "Industrial Zone B",
  "city": "Cebu",
  "is_verified": false,
  "profile": {
    "minimum_order_quantity": 100.00,
    "lead_time_days": 10,
    "delivery_terms": "CIF Cebu Port",
    "trust_rating": 5.00,
    "verification_status": "pending"
  }
}
```

### 2.3 `PATCH /api/suppliers/:id`

Modify wholesale limits, lead time expectations, or shipping rules.

**Request Body:**

```json
{
  "minimum_order_quantity": 80.00,
  "lead_time_days": 8
}
```

**Response Body (`200 OK`):**

```json
{
  "supplier_id": 202,
  "profile": {
    "minimum_order_quantity": 80.00,
    "lead_time_days": 8,
    "delivery_terms": "CIF Cebu Port",
    "trust_rating": 5.00,
    "verification_status": "pending"
  }
}
```

---

## 3. Logistics Domain (course deliverable — Sprint 2-CD)

Exposes the CIS 2104 courier subsystem (migrations 002/003) for the demo UI. Decoupled bounded context — no joins to marketplace tables. Money and measurement fields are JSON numbers. `current_status` is always derived from the latest `tracking_logs` row, never stored on the parcel (see `docs/LINKO_ERD.md`).

### 3.1 `GET /api/parcels`

List parcels with derived current status, most recently scanned first.

**Response Body (`200 OK`):**

```json
[
  {
    "parcel_id": "LKO-0005",
    "sender": { "customer_id": 5, "full_name": "Fishy Friends" },
    "receiver": { "customer_id": 7, "full_name": "Marielle Ocampo" },
    "tier_name": "Express",
    "weight_kg": 6.2,
    "shipping_fee": 318.15,
    "estimated_delivery_date": "2026-07-04",
    "current_status": "Out for Delivery",
    "last_scanned_at": "2026-07-05T09:47:21.662Z"
  }
]
```

### 3.2 `GET /api/parcels/:id`

Parcel detail with full tracking timeline (oldest first). `404` if unknown.

**Response Body (`200 OK`):**

```json
{
  "parcel_id": "LKO-0001",
  "sender": { "customer_id": 1, "full_name": "John's Pork", "phone_number": "0917-555-0101" },
  "receiver": { "customer_id": 7, "full_name": "Marielle Ocampo", "phone_number": "0918-555-0107" },
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

Book a parcel. The database fills `shipping_fee` (tier pricing trigger), `payments.amount` (goods + shipping), and the commission row. Also writes the first `'Order Created'` tracking log. `payment_status` starts `'Pending'`.

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

### 3.5 `GET /api/customers`

Customers with their addresses — feeds the book-a-parcel form's sender/receiver and origin/destination selects.

```json
[
  {
    "customer_id": 1,
    "full_name": "John's Pork",
    "phone_number": "0917-555-0101",
    "email": "orders@johnspork.ph",
    "customer_type": "msme",
    "addresses": [
      {
        "address_id": 1,
        "province": "Cebu",
        "city_municipality": "Cebu City",
        "barangay": "Mabolo",
        "street_address": "12 Pork Ave",
        "postal_code": "6000"
      }
    ]
  }
]
```
