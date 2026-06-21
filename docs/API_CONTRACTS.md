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

### 2.1 `GET /api/suppliers`
List suppliers matching search keywords or category filters.

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
Register business as wholesale provider.

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
