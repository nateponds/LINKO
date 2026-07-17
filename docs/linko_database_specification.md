# LINKO Database Specification

This document outlines the final PostgreSQL relational database schema for **LINKO**—a supply chain management platform for MSMEs, integrating inventory management, a wholesale marketplace, and full logistics capabilities.

---

## 1. Core Users, Auth & Businesses

### `users`
System users including MSME owners, staff, couriers, and administrators.
- `user_id` (SERIAL PRIMARY KEY)
- `username` (VARCHAR 50, UNIQUE)
- `password_hash` (TEXT)
- `email` (VARCHAR 100, UNIQUE)
- `role` (VARCHAR 20, check: owner, staff, wholesaler, admin)
- `full_name` (VARCHAR 100)
- `global_role` (VARCHAR 20)
- `created_at` (TIMESTAMP)

### `auth_sessions`
Active session tokens.
- `session_id` (VARCHAR 128 PRIMARY KEY)
- `user_id` (INT FK -> users)
- `token_hash` (TEXT)
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

### `businesses`
Companies, wholesalers, and MSME buyers registered on the platform.
- `business_id` (SERIAL PRIMARY KEY)
- `business_name` (VARCHAR 100)
- `business_type` (VARCHAR 20, check: buyer, wholesaler, individual, msme, corporation, other, logistics) — Sprint 9 dropped the `both` value; a single business can no longer be both buyer and wholesaler. The `one_marketplace_role_per_business` partial unique index on `business_memberships (user_id, business_id) WHERE role IN ('buyer','wholesaler')` enforces the same invariant at the membership level. Migration 022 added `logistics` for delivery organizations (canonical: `LINKO Logistics`); it is outside that index because a logistics org holds no marketplace role.
- `contact_number` (VARCHAR 20)
- `is_verified` (BOOLEAN)
- `created_at` (TIMESTAMP)

### `business_memberships`
Role-Based Access Control (RBAC) linking users to businesses.
- `membership_id` (SERIAL PRIMARY KEY)
- `user_id` (INT FK -> users)
- `business_id` (INT FK -> businesses)
- `role` (VARCHAR 30, check: buyer, wholesaler, logistics_coordinator, courier)
- `created_at` (TIMESTAMP)
*(Note: Replaces the legacy `user_businesses` table functionality with explicit roles).*

### `addresses`
Granular Philippine-hierarchy addresses.
- `address_id` (SERIAL PRIMARY KEY)
- `business_id` (INT FK -> businesses, nullable)
- `province` (VARCHAR 50)
- `city_municipality` (VARCHAR 50)
- `barangay` (VARCHAR 50)
- `street_address` (VARCHAR 150)
- `postal_code` (VARCHAR 10)

---

## 2. Catalog, Inventory & Market

### `categories`
Product taxonomy (seeded with categories like Pork, Beef, Produce, etc.).
- `category_id` (SERIAL PRIMARY KEY)
- `category_name` (VARCHAR 50, UNIQUE)

### `products`
Marketplace catalog and inventory items.
- `product_id` (SERIAL PRIMARY KEY)
- `business_id` (INT FK -> businesses)
- `product_name` (VARCHAR 100)
- `sku` (VARCHAR 50, nullable. UNIQUE when `is_active` = true)
- `category_id` (INT FK -> categories)
- `description` (TEXT)
- `unit_price` (NUMERIC 12,2)
- `image_url` (TEXT)
- `stock_quantity` (INTEGER)
- `is_active` (BOOLEAN, default TRUE - used for soft deletes)
- `created_at` (TIMESTAMP)

### `warehouses`
Physical storage locations for inventory.
- `warehouse_id` (SERIAL PRIMARY KEY)
- `business_id` (INT FK -> businesses)
- `warehouse_name` (VARCHAR 100)
- `address_id` (INT FK -> addresses)

### `supplier_profiles`
Extends business profiles for wholesalers.
- `supplier_id` (INT PK & FK -> businesses)
- `minimum_order_quantity` (DECIMAL 10,2)
- `lead_time_days` (INT)
- `delivery_terms` (TEXT)
- `trust_rating` (DECIMAL 3,2, default 5.00)
- `verification_status` (VARCHAR 20, check: pending, verified, rejected)

---

## 3. Orders & Invoices

### `orders`
Marketplace orders between buyers and wholesalers.
- `order_id` (SERIAL PRIMARY KEY)
- `buyer_business_id` (INT FK -> businesses)
- `wholesaler_business_id` (INT FK -> businesses)
- `tier_id` (INT FK -> service_tiers)
- `status` (VARCHAR 20, check: pending, accepted, preparing, shipped, delivered, cancelled, returned)
- `created_by` (INT FK -> users)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `order_items`
Snapshot of products and prices at the time of order.
- `order_item_id` (SERIAL PRIMARY KEY)
- `order_id` (INT FK -> orders)
- `product_id` (INT FK -> products)
- `quantity` (INT)
- `unit_price_snapshot` (NUMERIC 12,2)
- `created_at` (TIMESTAMP)

### `invoices`
Billing total for an order.
- `invoice_id` (SERIAL PRIMARY KEY)
- `order_id` (INT FK -> orders, UNIQUE)
- `invoice_number` (VARCHAR 40, UNIQUE)
- `total` (NUMERIC 12,2)
- `issued_at` (TIMESTAMP)

---

## 4. Logistics & Shipping

### `service_tiers`
Delivery speed and pricing tiers.
- `tier_id` (SERIAL PRIMARY KEY)
- `tier_name` (VARCHAR 50, UNIQUE)
- `base_rate_per_kg` (DECIMAL 10,2)
- `estimated_days` (INT)
- `base_fee` (DECIMAL 10,2)
- `rate_per_km` (DECIMAL 10,2)

### `branches`
Physical hubs for processing parcels.
- `branch_id` (SERIAL PRIMARY KEY)
- `branch_name` (VARCHAR 100, UNIQUE)
- `address_id` (INT FK -> addresses)
- `contact_number` (VARCHAR 20)

### `couriers`
Riders/drivers for parcel movement.
- `courier_id` (SERIAL PRIMARY KEY)
- `full_name` (VARCHAR 100)
- `phone_number` (VARCHAR 20)
- `vehicle_type` (VARCHAR 30)
- `assigned_branch_id` (INT FK -> branches)
- `user_id` (INT FK -> users, links rider to user account)

### `parcels`
Master package record. Standalone logistics bookings have `shipping_fee`
populated by the tier-pricing trigger. Marketplace-generated parcels explicitly
snapshot the order-item subtotal into `declared_value` and the selected tier's
quoted `base_fee` into `shipping_fee`, because marketplace checkout does not
collect physical package weight or route distance.
- `parcel_id` (VARCHAR 20 PRIMARY KEY)
- `sender_id` (INT FK -> businesses)
- `receiver_id` (INT FK -> businesses)
- `tier_id` (INT FK -> service_tiers)
- `origin_address_id` (INT FK -> addresses)
- `destination_address_id` (INT FK -> addresses)
- `weight_kg` (DECIMAL 6,2)
- `dimensions` (VARCHAR 50)
- `shipping_fee` (DECIMAL 10,2)
- `declared_value` (DECIMAL 12,2, default 0)
- `total_distance_km` (DECIMAL 8,2)
- `estimated_delivery_date` (DATE)

### `tracking_logs`
Append-only scan history for parcels.
- `log_id` (SERIAL PRIMARY KEY)
- `parcel_id` (VARCHAR 20 FK -> parcels)
- `branch_id` (INT FK -> branches, nullable)
- `courier_id` (INT FK -> couriers, nullable)
- `status_update` (VARCHAR 50)
- `remarks` (TEXT)
- `scanned_at` (TIMESTAMP)

### `payments`
Settlement for a parcel (goods + shipping). `amount` is set by trigger from `parcel`.
- `payment_id` (SERIAL PRIMARY KEY)
- `parcel_id` (VARCHAR 20 FK -> parcels, UNIQUE)
- `method` (VARCHAR 20)
- `payment_status` (VARCHAR 20)
- `amount` (DECIMAL 12,2)
- `paid_at` (TIMESTAMP)

---

## 6. Real-time Notifications

### `notifications`
Alerts for users on platform activity.
- `notification_id` (SERIAL PRIMARY KEY)
- `user_id` (INT FK -> users)
- `title` (VARCHAR 150)
- `message` (TEXT)
- `type` (VARCHAR 50, check: info, success, warning, error)
- `is_read` (BOOLEAN)
- `created_at` (TIMESTAMP)
