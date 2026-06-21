# Backlog

## Future Matching Criteria

Status: Deferred  
Suggested by: @nateponds  
Date added: 2026-06-19  
Area: Product / Backend / Frontend  
Priority: Low  
Related docs: `ROADMAP.md`, `BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`

Description:  
The MVP will match buyers and suppliers using only location and proximity. Consider adding merchandise type, product category, quantity, pricing, reliability, fulfillment capability, and similar criteria only after the basic workflow is validated and the team confirms that their value justifies the additional data and maintenance workload.

---

## Supplier Directory & Detail Pages

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Frontend  
Priority: Medium  
Related docs: `FRONTEND_GUIDE.md`, `ROADMAP.md`

Description:  
Build the UI for supplier browsing, search filters, and detail views to allow buyers to find and view supplier capacities.

Reason:  
Supplier discovery is a core part of LINKO's value proposition.

Expected outcome:  
Users can search, filter, and view detailed supplier profiles with static mock data.

---

## Logistics & Shipment Coordination View

Status: Deferred (Post-MVP)  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Frontend  
Priority: Low  
Related docs: `FRONTEND_GUIDE.md`, `ROADMAP.md`

Description:  
Build the Logistics page listing shipment records, status timelines, and dispatch info.

Expected outcome:  
Warehouse/logistics staff can visually track fulfillment pipelines.

---

## User Authentication & Role-Based Access

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Backend  
Priority: High  
Related docs: `BACKEND_GUIDE.md`

Description:  
Design and implement user registration, login, and JWT-based session management, separating buyer, supplier, warehouse, and logistics roles.

Expected outcome:  
Users can securely log in and access domain pages tailored to their specific roles.

---

## REST API Scaffolding & Express Router Setup

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Backend  
Priority: High  
Related docs: `BACKEND_GUIDE.md`

Description:  
Initialize Express.js backend project structure, routing modules for each domain (`/api/inventory`, `/api/suppliers`, `/api/orders`), and error-handling middleware.

Expected outcome:  
A clean backend repository scaffolded and ready for endpoint implementation.

---

## Database Schema Migration & PostgreSQL setup

Status: Proposed  
Suggested by: @Swashua  
Date added: 2026-06-21  
Area: Backend  
Priority: High  
Related docs: `BACKEND_GUIDE.md`

Description:  
Set up a PostgreSQL database instance and configure schema migrations for Business, InventoryItem, SupplierProfile, and Order tables.

Expected outcome:  
Working relational database with tracked schema evolution.
