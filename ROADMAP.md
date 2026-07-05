# LINKO Roadmap

## Purpose

LINKO is a supply chain management platform for MSMEs that centralizes supplier discovery, logistics coordination, shipment visibility, and inventory-related workflows. The goal is to help growing businesses manage stock, coordinate fulfillment, discover reliable wholesalers, build ongoing buyer-wholesaler relationships, and make supply-chain decisions with better visibility.

This roadmap is the central planning document for the project. It defines the product direction, major development phases, milestones, and feature goals.

## Product Vision

LINKO should become a practical operating platform for small and medium businesses that need clearer inventory control, easier supplier discovery, and smoother coordination between buyers, warehouses, wholesalers, and logistics partners.

The platform should eventually support:

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

Goal: Establish the robust PostgreSQL database and Express API to support the marketplace.

Core features:
- PostgreSQL schemas for Users, Businesses, Warehouses, Products, and Inventory.
- Inventory tracking APIs.
- Wholesaler profile foundations.

## Phase 2: Authentication & RBAC [Done]

Goal: Secure the platform with roles and sessions.

Core features:
- User authentication and hashed passwords.
- Business memberships and global roles (platform_admin).
- Persistent session tokens.

## Phase 3: Orders, Logistics, & Commissions [Done]

Goal: Connect discovery and matching to real business and fulfillment workflows.

Core features:
- Complete order and invoice tracking.
- Native logistics schemas (parcels, couriers, branches, tracking logs).
- Automated shipping fee calculation via service tiers.
- Platform commissions and wholesaler remittance views.

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
