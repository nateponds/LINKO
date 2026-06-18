# Linko Logistics Management System: Database Design & Implementation Specification
## Course: Information Management II
### System Objective & Handoff Specification

---

## 1. System Overview & Objective

**Linko** is a logistics and parcel lifecycle management platform designed to track shipments from initial pickup to final drop-off. The system records sender and receiver data, programmatically computes shipping tariffs using weight and tier metrics, and maintains an immutable historical ledger of every parcel's transit events through physical distribution hubs.

### Target Objectives for Consumer AI Agents:
1. **Database Initialization:** Replicate schema structures across standard SQL engines (MySQL/PostgreSQL compliant).
2. **API Generation:** Scaffold RESTful endpoints or GraphQL resolvers mirroring the entity models.
3. **State Validation:** Enforce state machine constraints ensuring parcel tracking lifecycle integrity.

---

## 2. Relational Database Schema Design (Data Dictionary)

### 2.1 Table: `Service_Tiers`
Defines operational service-level agreements (SLAs), delivery speed capabilities, and pricing multipliers.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `tier_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the service tier. |
| `tier_name` | VARCHAR(50) | NOT NULL, UNIQUE | Human-readable name (e.g., 'Standard', 'Express', 'Next-Day'). |
| `base_rate_per_kg` | DECIMAL(10,2) | NOT NULL, CHECK (`base_rate_per_kg` >= 0) | Price billed per kilogram in local currency. |
| `estimated_days` | INT | NOT NULL, CHECK (`estimated_days` >= 1) | Promised SLA delivery timeline window. |

### 2.2 Table: `Customers`
A unified directory capturing actors in both sending (origin) and receiving (destination) capacities.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `customer_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the entity. |
| `full_name` | VARCHAR(100) | NOT NULL | Complete personal or corporate name. |
| `phone_number` | VARCHAR(20) | NOT NULL | Contact number utilizing E.164 standardization format. |
| `email` | VARCHAR(100) | UNIQUE, NULLABLE | User contact and system notifications email address. |
| `address_line` | TEXT | NOT NULL | Delivery location street, building, and unit details. |
| `city` | VARCHAR(50) | NOT NULL | Municipal operational area used for initial routing lookups. |

### 2.3 Table: `Branches`
Physical fulfillment infrastructure and distribution hubs where parcels are sorted, processed, and routed.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `branch_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for the warehouse infrastructure. |
| `branch_name` | VARCHAR(100) | NOT NULL, UNIQUE | Name of the hub facility (e.g., 'Cebu Hub'). |
| `city` | VARCHAR(50) | NOT NULL | Physical city location of the hub entity. |
| `contact_number` | VARCHAR(20) | NULLABLE | Infrastructure desk phone line. |

### 2.4 Table: `Parcels`
The central operational transaction ledger reflecting real-time item specifications and active shipping statuses.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `parcel_id` | VARCHAR(20) | PRIMARY KEY | Unique human-readable alphanumeric identifier (e.g., 'LNK-10023456'). |
| `sender_id` | INT | FOREIGN KEY (`Customers.customer_id`) | References the initiating customer account. |
| `receiver_id` | INT | FOREIGN KEY (`Customers.customer_id`) | References the destination customer account. |
| `tier_id` | INT | FOREIGN KEY (`Service_Tiers.tier_id`) | Dictates SLA priority level and structural pricing variables. |
| `weight_kg` | DECIMAL(6,2) | NOT NULL, CHECK (`weight_kg` > 0.00) | Total physical mass weight value. |
| `dimensions` | VARCHAR(50) | NULLABLE | Metric representation of physical envelope space (LxWxH in cm). |
| `total_cost` | DECIMAL(10,2) | NOT NULL | Billed revenue calculated systematically. |
| `current_status` | VARCHAR(50) | NOT NULL, DEFAULT 'Order Created' | High-level status indicating active tracking phase. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Database ingestion timestamp mark. |

### 2.5 Table: `Tracking_Logs`
An append-only historical audit trail tracking physical routing lifecycle mutations and processing actions.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `log_id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique index for the tracking event record. |
| `parcel_id` | VARCHAR(20) | FOREIGN KEY (`Parcels.parcel_id`) ON DELETE CASCADE | Target master parcel document relation context. |
| `branch_id` | INT | FOREIGN KEY (`Branches.branch_id`), NULLABLE | Physical hub where scanning occurred. Null for line-haul. |
| `status_update` | VARCHAR(50) | NOT NULL | State machine status logged during checkpoint scanning. |
| `remarks` | TEXT | NULLABLE | Contextual logs (e.g., 'Delayed due to severe weather profile'). |
| `scanned_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Atomic ingestion event timestamp. |

---

## 3. SQL Data Definition Language (DDL) Script

```sql
-- Target Database System: MySQL / MariaDB (Standard Relational ANSI SQL compatible)
CREATE DATABASE IF NOT EXISTS linko_db;
USE linko_db;

-- 1. Service_Tiers Implementation
CREATE TABLE Service_Tiers (
    tier_id INT AUTO_INCREMENT PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL UNIQUE,
    base_rate_per_kg DECIMAL(10,2) NOT NULL,
    estimated_days INT NOT NULL,
    CONSTRAINT