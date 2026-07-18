# LINKO Roadmap

## Checkpoint Implementation Focus

The first checkpoint-ready slice of LINKO is the **Courier/Parcel Tracking** workflow documented in [local-notes/course-deliverable.md](./local-notes/course-deliverable.md). It serves as the platform's fulfillment foundation: once buyers, wholesalers, or businesses create operational demand, LINKO can represent the package, sender, receiver, service tier, route events, and delivery status.

The implemented system covers the required lifecycle:

- Logs sender and receiver information through shared business/customer and address records.
- Stores package weight, dimensions, declared value, service tier, and calculated shipping fee.
- Tracks delivery status through scan events from pickup to delivery.
- Shows a current parcel status in the app by deriving it from the latest tracking log.

Required core tables are implemented as:

| Course table | Implemented table(s) | Purpose |
| --- | --- | --- |
| `Service_Tiers` | `service_tiers` | Delivery speeds and base/per-weight/per-distance pricing. |
| `Customers` | `businesses`, `addresses` | Shared sender/receiver identity and contact/location details. |
| `Branches` | `branches` | Logistics hubs and warehouse-like processing locations. |
| `Parcels` | `parcels` | Package master record, including sender, receiver, weight, dimensions, fee, and delivery estimate. |
| `Tracking_Logs` | `tracking_logs` | Real-time parcel scan and status history. |

Implementation evidence lives in the logistics migrations, ERD, backend routes, tests, seed data, and live demo:

- `backend/migrations/002_logistics_schema.sql`
- `backend/migrations/003_linko_schema.sql`
- `docs/LINKO_ERD.md`
- `backend/src/routes/logistics.js`
- `backend/src/logistics-workflow.test.js`
- `docs/DEMO_SCRIPT.md`

Implementation note: LINKO derives each parcel's current status from the latest `tracking_logs` row. This keeps the tracking history as the source of truth while the UI still shows the current status for each parcel.

---

## Purpose

LINKO is a supply chain management platform for MSMEs that centralizes logistics coordination, shipment visibility, supplier discovery, and inventory-related workflows. The first implemented foundation is courier/parcel tracking; the marketplace, supplier discovery, ordering, and inventory concepts build on top of that operational base.

This roadmap is the central planning document for the project. It defines the product direction, major development phases, milestones, and feature goals.

## Product Vision

LINKO should become a practical operating platform for small and medium businesses that need smoother coordination between buyers, warehouses, wholesalers, and logistics partners, with clearer inventory control and easier supplier discovery added around those core operations.

The platform should eventually support:

- Courier/parcel lifecycle tracking from pickup to delivery.
- Service-tier based shipping fee calculation.
- Real-time inventory visibility across warehouses and stock locations.
- Wholesaler profiles for discovery and comparison.
- Matching workflows between MSMEs, buyers, wholesalers, and service providers.
- Order, shipment, and fulfillment coordination.
- Business dashboards for operational decisions.
- Mobile-friendly workflows for warehouse staff, owners, field teams, and wholesalers.

## Guiding Principles

- The backend API, data modeling, and core business logic form the true foundation of the project.
- Keep the early codebase simple and understandable.
- Design features so they can later support mobile apps and shared backend services.
- Prefer clear business workflows over excessive technical abstraction.
- Treat inventory, supplier discovery, orders, logistics coordination, and matching as core product domains.
- Keep documentation close to product decisions so future contributors understand why choices were made.

## Target Users

The initial frontend will focus on **MSME buyers**, as their demand drives the marketplace, orders, and logistics.

Other user groups include:
- Warehouse staff tracking incoming and outgoing inventory.
- Wholesalers looking for qualified buyers and repeat buyer relationships.
- Logistics coordinators handling deliveries, shipment status, and fulfillment.
- Platform administrators managing users, listings, verification, and marketplace quality.

## Core Product Domains

### Courier/Parcel Tracking
Manage service tiers, sender/receiver records, branches, parcels, delivery status, and tracking logs from pickup through delivery.

### Inventory
Track products, stock levels, categories, SKUs, movement history, reorder thresholds, and warehouse availability.

### Warehouse Operations
Support receiving, storage, picking, packing, stock adjustments, transfers, and basic audit trails.

### Supplier Discovery
Allow wholesalers to create profiles, list products or services, define service areas, pricing terms, minimum order quantities, and fulfillment capabilities.

### Supplier Matching
Match MSMEs or buyers with wholesalers using location and proximity. Merchandise type, product category, capacity, price, reliability, and other advanced criteria are deferred until the basic matching workflow has been validated.

### Orders and Fulfillment
Manage quote requests, wholesaler quotes, confirmed orders, shipment status, delivery confirmation, and issue tracking.

### Logistics Coordination
Natively manage shipment details, delivery status, warehouse dispatches, courier information, and fulfillment timelines directly within LINKO.

### Analytics
Provide simple insights such as low-stock alerts, wholesaler performance, order volume, lead conversion, fulfillment delays, and inventory movement trends.

## Development Phases

## Phase 0: Project Foundation [Done]

Goal: Establish the project direction and basic development setup.

## Phase 1: Backend API & Database Foundation [Done]

Goal: Establish the robust PostgreSQL database and Express API for courier/parcel tracking first, while leaving room for the marketplace modules that follow.

Core features:
- PostgreSQL schemas for service tiers, businesses/customers, addresses, branches, parcels, tracking logs, users, warehouses, products, and inventory.
- Courier/parcel tracking tables and relationships required for the checkpoint.
- Inventory tracking APIs.
- Wholesaler profile foundations.

## Phase 2: Authentication & RBAC [Done]

Goal: Secure the platform with roles and sessions.

Core features:
- User authentication and hashed passwords.
- Business memberships and global roles (platform_admin).
- Persistent session tokens.

## Phase 3: Orders & Logistics [Done]

Goal: Connect discovery and matching to real business and fulfillment workflows.

Core features:
- Courier/parcel lifecycle from booking through tracking updates.
- Complete order and invoice tracking.
- Native logistics schemas (parcels, couriers, branches, tracking logs).
- Automated shipping fee calculation via service tiers.

## Phase 4: Basic Frontend & API Integration [Active]

Goal: Build out the React UI to connect with the established backend workflows, balancing Inventory and Wholesaler Discovery.

Core features:
- Landing or dashboard page.
- Inventory list and detail pages.
- Wholesaler directory and profile pages.
- Order placement flows.
- Connecting the UI fully to the Node.js API.

## Phase 5: Supplier Matching

Goal: Introduce a minimum matching workflow that connects buyers with nearby wholesalers.

Core features:
- Buyer requirement form.
- Location and proximity-based recommendation ranking.
- Distance or proximity match reasons.
- Wholesaler shortlist.

## Phase 6: Mobile-Friendly Expansion

Goal: Prepare the platform for mobile app development without forcing a premature rewrite.

Core features:
- Responsive web workflows.
- Mobile-first inventory actions.
- Field-friendly order and shipment updates.

## Phase 7: Platform Hardening and Growth

Goal: Improve reliability, trust, performance, and marketplace quality.

Core features:
- Admin dashboard.
- Advanced analytics.
- Performance optimization.
- Automated tests for core workflows.

## Resolved Strategic Decisions (Formerly Open Questions)

- **Target User**: Focus first on MSME buyers to drive marketplace demand.
- **Core Focus**: Aim for a balanced approach between Inventory Management and Wholesaler Discovery.
- **Target Market**: Launch a pilot in the Philippines (Cebu/Visayas region).
- **Logistics**: Use natively managed tracking via the built-in logistics schema (no 3rd-party integration yet).
- **Verification**: Utilize a manual admin verification process for wholesalers (`verification_status`).
- **Location Rules**: Distance will be measured in Kilometers (km), starting with a 50km default radius. Initial matching will use City/Municipality string matching.

## Current Status

Status: Backend Foundation is fully built and deployed.
Next recommended milestone: Complete the Basic Frontend & API Integration (Phase 4).
