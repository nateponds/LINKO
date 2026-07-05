# LINKO Core Subsystem: Database Design & Implementation Specification

## Course: Information Management II

### Context: Phase 2 (Data Modeling) & Phase 3 (Inventory) / Phase 4 (Suppliers) Alignment

---

## 1. System Overview & Roadmap Alignment

This document outlines the database schema for the **Core Inventory Tracking** and **Supplier Profiles** domains of **LINKO**—a supply chain management platform for MSMEs with a wholesaler-facing marketplace. This relational schema replaces the deferred Logistics design to align with the revised Sprint 1-BE scope.

### Domain Schema Mappings:

- **`Users` / `Businesses` / `User_Businesses` Tables:** Capture authentication and role-based membership for MSME owners, staff, and wholesalers.
- **`Products` / `Inventory_Items` / `Warehouses` Tables:** Track products, stock levels, categories, SKUs, and warehouse assignments.
- **`Inventory_Transactions` Table:** Appends movement history (in, out, adjustment, transfer) for compliance and auditing.
- **`Supplier_Profiles` Table:** Stores MoQ (Minimum Order Quantity), lead times, and terms for businesses that act as wholesalers.

---

## 2. Relational Database Schema Design (Data Dictionary)

### 2.1 Table: `Users`

Authentication credentials, system roles, and account records.

| Column Name     | Data Type    | Constraints               | Description                                                |
| :-------------- | :----------- | :------------------------ | :--------------------------------------------------------- |
| `user_id`       | SERIAL       | PRIMARY KEY               | Unique ID for system users.                                |
| `username`      | VARCHAR(50)  | NOT NULL, UNIQUE          | User login identifier.                                     |
| `password_hash` | TEXT         | NOT NULL                  | Secure salted hash of user credentials.                    |
| `email`         | VARCHAR(100) | NOT NULL, UNIQUE          | Account contact email.                                     |
| `role`          | VARCHAR(20)  | NOT NULL                  | User authorization role (owner, staff, wholesaler, admin). |
| `created_at`    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Record generation date.                                    |

### 2.2 Table: `Businesses`

Companies, wholesalers, and MSME buyers registered on the platform.

| Column Name      | Data Type    | Constraints               | Description                                 |
| :--------------- | :----------- | :------------------------ | :------------------------------------------ |
| `business_id`    | SERIAL       | PRIMARY KEY               | Unique ID for business entities.            |
| `business_name`  | VARCHAR(100) | NOT NULL                  | Registered name of business.                |
| `business_type`  | VARCHAR(20)  | NOT NULL                  | Role of business (buyer, wholesaler, both, individual, msme, corporation, other). |
| `contact_number` | VARCHAR(20)  |                           | Telephone contact info.                     |
| `is_verified`    | BOOLEAN      | DEFAULT FALSE             | Administrator trust verification status.    |
| `created_at`     | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Ingestion timestamp.                        |

### 2.3 Table: `User_Businesses`

Associates platform users with business entities.

| Column Name   | Data Type | Constraints           | Description              |
| :------------ | :-------- | :-------------------- | :----------------------- |
| `user_id`     | INT       | FK (`Users`), PK      | User linked to business. |
| `business_id` | INT       | FK (`Businesses`), PK | Business linked to user. |

### 2.4 Table: `Addresses`

Structured location records with Philippine hierarchy.

| Column Name         | Data Type    | Constraints       | Description                             |
| :------------------ | :----------- | :---------------- | :-------------------------------------- |
| `address_id`        | SERIAL       | PRIMARY KEY       | Unique address location ID.             |
| `business_id`       | INT          | FK (`Businesses`) | Owner business relationship hook.       |
| `province`          | VARCHAR(50)  | NOT NULL          | Province name.                          |
| `city_municipality` | VARCHAR(50)  | NOT NULL          | City or Municipality.                   |
| `barangay`          | VARCHAR(50)  |                   | Barangay (optional).                    |
| `street_address`    | VARCHAR(150) |                   | Granular street line.                   |
| `postal_code`       | VARCHAR(10)  |                   | ZIP code.                               |

### 2.4 Table: `Warehouses`

Storage infrastructure owned by businesses, with `warehouse` as the canonical operational term.

| Column Name      | Data Type    | Constraints       | Description                             |
| :--------------- | :----------- | :---------------- | :-------------------------------------- |
| `warehouse_id`   | SERIAL       | PRIMARY KEY       | Unique storage location ID.             |
| `business_id`    | INT          | FK (`Businesses`) | Owner business relationship hook.       |
| `warehouse_name` | VARCHAR(100) | NOT NULL          | Name of warehouse facility.             |
| `address_id`     | INT          | FK (`Addresses`)  | Location details of physical warehouse. |

### 2.5 Table: `Categories`

Standard taxonomic categories for grouping inventory items.

| Column Name     | Data Type   | Constraints      | Description                    |
| :-------------- | :---------- | :--------------- | :----------------------------- |
| `category_id`   | SERIAL      | PRIMARY KEY      | Unique taxonomic ID.           |
| `category_name` | VARCHAR(50) | NOT NULL, UNIQUE | Human-readable category label. |

### 2.6 Table: `Products`

Catalog metadata definitions. Linked to a parent company.

| Column Name    | Data Type    | Constraints               | Description                                  |
| :------------- | :----------- | :------------------------ | :------------------------------------------- |
| `product_id`   | SERIAL       | PRIMARY KEY               | Unique catalog product ID.                   |
| `business_id`  | INT          | FK (`Businesses`)         | Creator business reference hook.             |
| `product_name` | VARCHAR(100) | NOT NULL                  | Catalog product name.                        |
| `sku`          | VARCHAR(50)  | NOT NULL, UNIQUE          | Stock Keeping Unit code.                     |
| `category_id`  | INT          | FK (`Categories`)         | Assigned product category.                   |
| `description`  | TEXT         |                           | Markdown or plain-text specification detail. |
| `created_at`   | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Record birth timestamp.                      |

### 2.7 Table: `Inventory_Items`

Tracked physical quantity mapping a `Product` to a storage location `Warehouse`.

| Column Name         | Data Type   | Constraints               | Description                                 |
| :------------------ | :---------- | :------------------------ | :------------------------------------------ |
| `item_id`           | SERIAL      | PRIMARY KEY               | Unique stock identifier.                    |
| `product_id`        | INT         | FK (`Products`)           | Target product definition.                  |
| `warehouse_id`      | INT         | FK (`Warehouses`)         | Location of storage.                        |
| `quantity`          | INT         | NOT NULL, DEFAULT 0       | Current stock availability count.           |
| `unit`              | VARCHAR(20) | NOT NULL, DEFAULT 'pcs'   | Measurement unit (pcs, kg, boxes, bags).    |
| `reorder_threshold` | INT         | NOT NULL, DEFAULT 10      | Quantity threshold trigger low-stock state. |
| `created_at`        | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP | Ingestion timestamp.                        |

### 2.8 Table: `Inventory_Transactions`

Audit trail recording stock alterations (inbound, outbound, transfers).

| Column Name        | Data Type   | Constraints               | Description                                  |
| :----------------- | :---------- | :------------------------ | :------------------------------------------- |
| `transaction_id`   | SERIAL      | PRIMARY KEY               | Unique audit entry identifier.               |
| `item_id`          | INT         | FK (`Inventory_Items`)    | Modified stock item hook.                    |
| `transaction_type` | VARCHAR(20) | NOT NULL                  | Action type (in, out, adjustment, transfer). |
| `quantity_change`  | INT         | NOT NULL                  | Delta stock value change.                    |
| `remarks`          | TEXT        |                           | Operational context explanations.            |
| `created_by`       | INT         | FK (`Users`), NULLABLE    | Staff user triggering transaction.           |
| `created_at`       | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP | Atomic log timestamp.                        |

### 2.9 Table: `Supplier_Profiles`

Extends `Businesses` profile properties for wholesalers.

| Column Name              | Data Type     | Constraints                    | Description                                |
| :----------------------- | :------------ | :----------------------------- | :----------------------------------------- |
| `supplier_id`            | INT           | PRIMARY KEY, FK (`Businesses`) | Target company identity.                   |
| `minimum_order_quantity` | DECIMAL(10,2) | NOT NULL, DEFAULT 1.00         | Minimum allowed order value / quantity.    |
| `lead_time_days`         | INT           | NOT NULL, DEFAULT 7            | Average fulfillment window duration.       |
| `delivery_terms`         | TEXT          |                                | Pricing, terms, shipping guidelines.       |
| `trust_rating`           | DECIMAL(3,2)  | DEFAULT 5.00                   | Average rating metric.                     |
| `verification_status`    | VARCHAR(20)   | DEFAULT 'pending'              | State check (pending, verified, rejected). |

---

## 3. SQL Data Definition Language (DDL) Script (PostgreSQL)

```sql
-- Create custom extension for security UUIDs if required later
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Implementation
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff', 'supplier', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Businesses Implementation
CREATE TABLE Businesses (
    business_id SERIAL PRIMARY KEY,
    business_name VARCHAR(100) NOT NULL,
    business_type VARCHAR(20) NOT NULL CHECK (business_type IN ('buyer', 'supplier', 'both')),
    contact_number VARCHAR(20),
    address_line TEXT NOT NULL,
    city VARCHAR(50) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. User_Businesses Association Table
CREATE TABLE User_Businesses (
    user_id INT REFERENCES Users(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
    business_id INT REFERENCES Businesses(business_id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, business_id)
);

-- 4. Warehouses Implementation
CREATE TABLE Warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES Businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    warehouse_name VARCHAR(100) NOT NULL,
    address_line TEXT NOT NULL,
    city VARCHAR(50) NOT NULL
);

-- 5. Categories Implementation
CREATE TABLE Categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE
);

-- 6. Products Catalog Implementation
CREATE TABLE Products (
    product_id SERIAL PRIMARY KEY,
    business_id INT NOT NULL REFERENCES Businesses(business_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    product_name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    category_id INT REFERENCES Categories(category_id) ON UPDATE CASCADE ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Inventory_Items Location Stock Implementation
CREATE TABLE Inventory_Items (
    item_id SERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES Products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    warehouse_id INT NOT NULL REFERENCES Warehouses(warehouse_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
    reorder_threshold INT NOT NULL DEFAULT 10 CHECK (reorder_threshold >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, warehouse_id)
);

-- 8. Inventory_Transactions Audit Log Implementation
CREATE TABLE Inventory_Transactions (
    transaction_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES Inventory_Items(item_id) ON UPDATE CASCADE ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('in', 'out', 'adjustment', 'transfer')),
    quantity_change INT NOT NULL,
    remarks TEXT,
    created_by INT REFERENCES Users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Supplier_Profiles Extension Implementation
CREATE TABLE Supplier_Profiles (
    supplier_id INT PRIMARY KEY REFERENCES Businesses(business_id) ON UPDATE CASCADE ON DELETE CASCADE,
    minimum_order_quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    lead_time_days INT NOT NULL DEFAULT 7 CHECK (lead_time_days >= 0),
    delivery_terms TEXT,
    trust_rating DECIMAL(3,2) DEFAULT 5.00 CHECK (trust_rating >= 0.00 AND trust_rating <= 5.00),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);
```

---

## 4. Automation & Performance Optimization

### 4.1 Automated Mutation Logging Trigger (PostgreSQL Pl/pgSQL)

Triggers automated records whenever stock amounts undergo direct database updates.

```sql
CREATE OR REPLACE FUNCTION fn_log_inventory_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.quantity <> NEW.quantity THEN
        INSERT INTO Inventory_Transactions (item_id, transaction_type, quantity_change, remarks)
        VALUES (NEW.item_id, 'adjustment', NEW.quantity - OLD.quantity, 'Quantity auto-adjusted in stock update.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_inventory_mutation
AFTER UPDATE ON Inventory_Items
FOR EACH ROW
EXECUTE FUNCTION fn_log_inventory_mutation();
```

### 4.2 High-Speed Indexes

Optimizes SKU matching catalog speed and quick warehouse queries.

```sql
CREATE INDEX idx_products_sku ON Products(sku);
CREATE INDEX idx_inventory_lookup ON Inventory_Items(warehouse_id, product_id);
CREATE INDEX idx_transactions_timeline ON Inventory_Transactions(item_id, created_at DESC);
```

---

## 5. Strategic Extensions (Saved Logistics Hooks)

If Logistics Coordination is restored later, use the archived file [archive_logistics_database_specification.md](./archive_logistics_database_specification.md) to integrate with these tables:

- Link `Parcels` shipper (`sender_id`) to `Businesses(business_id)`.
- Map `Branches` directly to `Warehouses(warehouse_id)`.
- Reference order origins by building an `Orders` table linked to `Businesses` profiles.
