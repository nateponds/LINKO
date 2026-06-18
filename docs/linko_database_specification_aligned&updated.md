# LINKO Logistics Subsystem: Database Design & Implementation Specification
## Course: Information Management II
### Context: Phase 2 (Data Modeling) & Phase 7 (Logistics Coordination) Alignment

---

## 1. System Overview & Roadmap Alignment

This document outlines the database schema for the **Logistics Coordination** domain of **LINKO**—a platform designed for MSMEs and wholesale providers. While the complete LINKO ecosystem eventually tracks Inventory, Suppliers, and Matching workflows, this specific relational schema fulfills the core requirements for managing a parcel's lifecycle from pickup to drop-off.

### Domain Integration Hooks:
* **`Customers` Table:** Acts as the base directory for MSME Buyers, Retailers, and Wholesale Suppliers when they act as shippers or consignees in the logistics loop.
* **`Branches` Table:** Represents the physical fulfillment infrastructure, physical hubs, and warehouses highlighted in the *Warehouse Operations* domain.
* **`Parcels` Table:** Serves as the physical fulfillment manifest tied directly to final *Orders and Fulfillment* pipelines.

---

## 2. Relational Database Schema Design (Data Dictionary)

### 2.1 Table: `Service_Tiers`
Defines operational service-level agreements (SLAs), delivery speeds, and pricing multipliers.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `tier_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the service tier. |
| `tier_name` | VARCHAR(50) | NOT NULL, UNIQUE | Human-readable name (e.g., 'Standard', 'Express', 'Next-Day'). |
| `base_rate_per_kg` | DECIMAL(10,2) | NOT NULL | Price billed per kilogram in local currency. |
| `estimated_days` | INT | NOT NULL | Promised SLA delivery timeline window in days. |

### 2.2 Table: `Customers`
A unified directory capturing platform actors (MSMEs, Suppliers, Buyers) in their logistical capacities as senders or receivers.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `customer_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the customer profile. |
| `full_name` | VARCHAR(100) | NOT NULL | Complete personal or corporate name. |
| `phone_number` | VARCHAR(20) | NOT NULL | Contact number utilizing E.164 standardization format. |
| `email` | VARCHAR(100) | UNIQUE | User contact and system notifications email address. |
| `address_line` | TEXT | NOT NULL | Delivery location street, building, and unit details. |
| `city` | VARCHAR(50) | NOT NULL | Municipal area used for initial routing and regional filters. |

### 2.3 Table: `Branches`
Physical warehouse infrastructure and distribution hubs where inventory is stored and parcels are sorted.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `branch_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the warehouse/hub facility. |
| `branch_name` | VARCHAR(100) | NOT NULL, UNIQUE | Name of the hub facility (e.g., 'Cebu Hub', 'Manila Sortation Center'). |
| `city` | VARCHAR(50) | NOT NULL | Physical city location of the hub entity. |
| `contact_number` | VARCHAR(20) | | Infrastructure desk phone line. |

### 2.4 Table: `Parcels`
The master operational tracking transaction record reflecting real-time package specs and fulfillment states.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `parcel_id` | VARCHAR(20) | PRIMARY KEY | Unique alphanumeric tracking number (e.g., 'LNK-10023456'). |
| `sender_id` | INT | FOREIGN KEY (`Customers`) | References the initiating customer account (e.g., Supplier). |
| `receiver_id` | INT | FOREIGN KEY (`Customers`) | References the destination customer account (e.g., MSME Buyer). |
| `tier_id` | INT | FOREIGN KEY (`Service_Tiers`) | Dictates SLA priority level and structural pricing variables. |
| `weight_kg` | DECIMAL(6,2) | NOT NULL | Total physical mass weight value. |
| `dimensions` | VARCHAR(50) | | Physical package space dimensions (e.g., '30x30x30 cm'). |
| `total_cost` | DECIMAL(10,2) | NOT NULL | Billed shipping revenue calculated systematically. |
| `current_status` | VARCHAR(50) | NOT NULL | High-level status indicating active tracking phase. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Database ingestion timestamp mark. |

### 2.5 Table: `Tracking_Logs`
An append-only historical audit trail tracking physical routing lifecycle mutations and scan actions.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `log_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique index for the tracking event record. |
| `parcel_id` | VARCHAR(20) | FOREIGN KEY (`Parcels`) | Target master parcel document relation context. |
| `branch_id` | INT | FOREIGN KEY (`Branches`), NULLABLE | Physical hub where scanning occurred. Null for line-haul transit. |
| `status_update` | VARCHAR(50) | NOT NULL | State status logged during checkpoint scanning. |
| `remarks` | TEXT | | Contextual notes (e.g., 'Sorted for local dispatch'). |
| `scanned_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Atomic ingestion event timestamp. |

---

## 3. SQL Data Definition Language (DDL) Script

```sql
CREATE DATABASE IF NOT EXISTS linko_db;
USE linko_db;

-- 1. Service_Tiers Implementation
CREATE TABLE Service_Tiers (
    tier_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    base_rate_per_kg DECIMAL(10,2) NOT NULL,
    estimated_days INT NOT NULL
) ENGINE=InnoDB;

-- 2. Customers Implementation
CREATE TABLE Customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE,
    address_line TEXT NOT NULL,
    city VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

-- 3. Branches Implementation
CREATE TABLE Branches (
    branch_id INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL UNIQUE,
    city VARCHAR(50) NOT NULL,
    contact_number VARCHAR(20)
) ENGINE=InnoDB;

-- 4. Parcels Implementation
CREATE TABLE Parcels (
    parcel_id VARCHAR(20) PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    tier_id INT NOT NULL,
    weight_kg DECIMAL(6,2) NOT NULL,
    dimensions VARCHAR(50),
    total_cost DECIMAL(10,2) NOT NULL,
    current_status VARCHAR(50) NOT NULL DEFAULT 'Order Created',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (receiver_id) REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (tier_id) REFERENCES Service_Tiers(tier_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5. Tracking_Logs Implementation
CREATE TABLE Tracking_Logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    parcel_id VARCHAR(20) NOT NULL,
    branch_id INT NULL,
    status_update VARCHAR(50) NOT NULL,
    remarks TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parcel_id) REFERENCES Parcels(parcel_id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES Branches(branch_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;
```

---

## 4. Automation & Performance Optimization

### 4.1 Cost Calculation Routine (`BEFORE INSERT` Trigger)
Keeps shipping metrics decoupled from application code errors.

```sql
DELIMITER $$

CREATE TRIGGER trg_calculate_shipping_cost
BEFORE INSERT ON Parcels
FOR EACH ROW
BEGIN
    DECLARE v_rate DECIMAL(10,2);
    SELECT base_rate_per_kg INTO v_rate FROM Service_Tiers WHERE tier_id = NEW.tier_id;
    SET NEW.total_cost = NEW.weight_kg * v_rate;
END$$

DELIMITER ;
```

### 4.2 Append-Only History Logging Triggers
Automatically updates the tracking log timeline whenever a parcel status shifts.

```sql
DELIMITER $$

CREATE TRIGGER trg_log_parcel_initialization
AFTER INSERT ON Parcels
FOR EACH ROW
BEGIN
    INSERT INTO Tracking_Logs (parcel_id, branch_id, status_update, remarks)
    VALUES (NEW.parcel_id, NULL, NEW.current_status, 'Fulfillment pipeline initialized.');
END$$

CREATE TRIGGER trg_log_parcel_mutation
AFTER UPDATE ON Parcels
FOR EACH ROW
BEGIN
    IF OLD.current_status <> NEW.current_status THEN
        INSERT INTO Tracking_Logs (parcel_id, branch_id, status_update, remarks)
        VALUES (NEW.parcel_id, NULL, NEW.current_status, CONCAT('Status updated from ', OLD.current_status, ' to ', NEW.current_status));
    END IF;
END$$

DELIMITER ;
```

### 4.3 High-Speed Query Indexes
Optimizes timeline loading for mobile views and regional filtering dashboards.

```sql
CREATE INDEX idx_tracking_composite ON Tracking_Logs (parcel_id, scanned_at DESC);
CREATE INDEX idx_customers_city ON Customers (city);
```

---

## 5. Strategic Architectural Extensions (For Future Phased Scaling)

To support the wider LINKO roadmap using this database design as a foundation, subsequent implementation modules should append the following structural connections:

1.  **To Support Phase 3 (Inventory & Warehouse Tracking):**
    * Create a `Products` table (SKUs, description, category).
    * Create a `Warehouse_Stock` table linking `Products` to `Branches` (acting as storage locations) with a `quantity` column.
2.  **To Support Phase 4 & 5 (Suppliers & Matching):**
    * Extend `Customers` or create a `Supplier_Profiles` table detailing Minimum Order Quantities (MOQ), lead times, and verification state metrics.
3.  **To Support Phase 6 (Orders and Fulfillment):**
    * Create an `Orders` table recording purchase transactions between buyers and suppliers.
    * Add an optional `order_id` column to the `Parcels` table to link a logistics tracking lifecycle back to its originating wholesale transaction.

---

## 6. Consumer AI Ingestion Directive

> **System Prompt Directive for Downstream Agents:**
> Implement the schema outlined in Section 3. Use Section 5 as an explicit guide on how to integrate this logistics module with core Inventory, Supplier Profiles, and Order tables when developing subsequent dashboard models. Maintain the trigger calculations locally within testing entities to ensure transaction records remain synchronous.
