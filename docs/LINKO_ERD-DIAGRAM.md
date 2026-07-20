# LINKO — Entity Relationship Diagram (Market & Logistics)

Scoped to LINKO's two product domains — the buyer–wholesaler **marketplace** (businesses, catalog,
orders, invoices) and the CIS 2104 **logistics** core (parcels, payments, tracking, routing).
`users` and `businesses` are retained as the actor tables; the auth/identity plumbing
(`auth_sessions`, `user_businesses`, `business_memberships`) is intentionally omitted as
out-of-domain infrastructure.

```mermaid
erDiagram
    %% ===== Organizations & addresses =====
    businesses           ||--o{ addresses             : "owns"
    addresses            |o--o{ businesses            : "logistics address for"

    %% ===== Marketplace catalog =====
    businesses           ||--o{ warehouses            : "operates"
    addresses            ||--o{ warehouses            : "located at"
    businesses           ||--o{ products              : "sells"
    categories           |o--o{ products              : "classifies"
    businesses           ||--|| supplier_profiles     : "profile"

    %% ===== Logistics core (CIS 2104 graded) =====
    addresses            ||--o{ branches              : "located at"
    branches             |o--o{ couriers              : "assigns"
    users                |o--o{ couriers              : "linked account"

    %% ===== Marketplace orders =====
    businesses           ||--o{ orders                : "buys"
    businesses           ||--o{ orders                : "supplies"
    service_tiers        ||--o{ orders                : "shipped via"
    users                |o--o{ orders                : "created by"
    orders               ||--o{ order_items           : "contains"
    products             ||--o{ order_items           : "ordered as"
    orders               ||--|| invoices              : "billed by"

    %% ===== Parcels, payments, tracking =====
    businesses           ||--o{ parcels               : "sends"
    businesses           ||--o{ parcels               : "receives"
    service_tiers        ||--o{ parcels               : "priced by"
    addresses            ||--o{ parcels               : "origin"
    addresses            ||--o{ parcels               : "destination"
    orders               |o--o{ parcels               : "fulfilled by"
    parcels              ||--|| payments               : "paid by"
    parcels              ||--o{ tracking_logs          : "scanned in"
    branches             |o--o{ tracking_logs          : "checkpoint"
    couriers             |o--o{ tracking_logs          : "scanned by"
    parcels              ||--o{ parcel_route_stops      : "planned route"
    addresses            |o--o{ parcel_route_stops      : "route source"
    branches             |o--o{ parcel_route_stops      : "route hub"

    %% ===== Notifications =====
    users                ||--o{ notifications          : "receives"

    %% =========================================================
    users {
        int       user_id       PK
        varchar   username       UK
        text      password_hash
        varchar   email          UK
        varchar   full_name
        varchar   role
        varchar   global_role
        boolean   is_active
        timestamp created_at
    }

    businesses {
        int       business_id           PK
        varchar   business_name
        varchar   business_type
        varchar   contact_number
        boolean   is_verified
        int       logistics_address_id  FK
        timestamp created_at
    }

    addresses {
        int       address_id         PK
        int       business_id        FK
        varchar   province
        varchar   city_municipality
        varchar   barangay
        varchar   street_address
        varchar   postal_code
        decimal   latitude
        decimal   longitude
        timestamp created_at
    }

    categories {
        int       category_id   PK
        varchar   category_name UK
        timestamp created_at
    }

    warehouses {
        int       warehouse_id   PK
        int       business_id    FK
        varchar   warehouse_name
        int       address_id     FK
        timestamp created_at
    }

    products {
        int       product_id     PK
        int       business_id    FK
        varchar   product_name
        varchar   sku
        int       category_id    FK
        text      description
        numeric   unit_price
        text      image_url
        int       stock_quantity
        boolean   is_active
        timestamp created_at
        timestamp updated_at
    }

    supplier_profiles {
        int       supplier_id            PK,FK
        decimal   minimum_order_quantity
        int       lead_time_days
        text      delivery_terms
        decimal   trust_rating
        varchar   verification_status
        timestamp created_at
    }

    service_tiers {
        int       tier_id          PK
        varchar   tier_name        UK
        decimal   base_rate_per_kg
        int       estimated_days
        decimal   base_fee
        decimal   rate_per_km
    }

    branches {
        int       branch_id      PK
        varchar   branch_name
        int       address_id     FK
        varchar   contact_number
        boolean   is_active
        boolean   is_available
    }

    couriers {
        int       courier_id         PK
        varchar   full_name
        varchar   phone_number
        varchar   vehicle_type
        int       assigned_branch_id FK
        int       user_id            FK
        boolean   is_active
    }

    orders {
        int       order_id               PK
        int       buyer_business_id      FK
        int       wholesaler_business_id FK
        int       tier_id                FK
        varchar   status
        int       created_by             FK
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        int       order_item_id       PK
        int       order_id            FK
        int       product_id          FK
        int       quantity
        numeric   unit_price_snapshot
        timestamp created_at
    }

    invoices {
        int       invoice_id     PK
        int       order_id       FK,UK
        varchar   invoice_number UK
        numeric   total
        timestamp issued_at
        timestamp updated_at
    }

    parcels {
        varchar   parcel_id               PK
        int       sender_id               FK
        int       receiver_id             FK
        int       tier_id                 FK
        int       origin_address_id       FK
        int       destination_address_id  FK
        int       order_id                FK
        decimal   weight_kg
        varchar   dimensions
        decimal   shipping_fee
        decimal   declared_value
        decimal   total_distance_km
        date      estimated_delivery_date
    }

    payments {
        int       payment_id     PK
        varchar   parcel_id      FK,UK
        varchar   method
        varchar   payment_status
        decimal   amount
        timestamp paid_at
    }

    tracking_logs {
        int       log_id        PK
        varchar   parcel_id     FK
        int       branch_id     FK
        int       courier_id    FK
        varchar   status_update
        text      remarks
        timestamp scanned_at
    }

    parcel_route_stops {
        varchar   parcel_id         PK,FK
        smallint  stop_order        PK
        varchar   stop_type
        int       source_address_id FK
        int       branch_id         FK
        varchar   label
        varchar   province
        varchar   city_municipality
        varchar   barangay
        varchar   street_address
        varchar   postal_code
        numeric   latitude
        numeric   longitude
    }

    notifications {
        int       notification_id PK
        int       user_id         FK
        varchar   title
        text      message
        varchar   type
        boolean   is_read
        timestamp created_at
    }
```
