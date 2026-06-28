# Backlog

## Future Matching Criteria

Status: Deferred  
Suggested by: @nateponds  
Date added: 2026-06-19  
Area: Product / Backend / Frontend  
Priority: Low  
Related docs: `ROADMAP.md`, `BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`

Description:  
The MVP will match buyers and wholesalers using only location and proximity. Consider adding merchandise type, product category, quantity, pricing, reliability, fulfillment capability, and similar criteria only after the basic workflow is validated and the team confirms that their value justifies the additional data and maintenance workload.

---

## Supplier Directory & Detail Pages

Status: Proposed  
Suggested by: @nateponds  
Date added: 2026-06-21  
Area: Frontend  
Priority: Medium  
Related docs: `FRONTEND_GUIDE.md`, `ROADMAP.md`

Description:  
Build the UI for wholesaler browsing, search filters, and detail views to allow buyers to find and view wholesaler capacities.

Reason:  
Supplier discovery is a core part of LINKO's value proposition for helping buyers find wholesalers.

Expected outcome:  
Users can search, filter, and view detailed wholesaler profiles with static mock data.

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
Design and implement user registration, login, and JWT-based session management, separating buyer, wholesaler, warehouse, and logistics roles.

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

---

## Technical Discussion: Finance and Contract 

Status: Proposed  
Suggested by: @BaelJM  
Date added: 2026-06-24  
Area: Product  
Priority: Medium  
Related docs: None

Description:
Make decisions regarding how, when, and by what method a client must pay for goods or services.

Reason:
No money, no business

Expected outcome:
Reach a conclusion that is most beneficial for all parties involved.

Notes:
Core areas to discuss include:

`Invoicing & Accounts Receivable (A/R)` 
Terms are explicitly stated on every invoice to establish due dates and acceptable payment methods. Standard structures include __Net 30 (payment due in 30 days), Net 60, or Due on Receipt.__

`Sales & Procurement Contracts`
Payment terms serve as a foundational, legally binding clause within vendor agreements and sales contracts. They dictate __payment milestones__ (such as progress or stage payments), __early payment discounts__ (e.g., 2% 10 Net 30), and __penalties for late payments.__

`Supply Chain & Inventory`
Businesses set payment terms with suppliers (Accounts Payable) to optimize cash flow. Options here include __COD (Cash on Delivery) or PIA (Payment in Advance)__ to mitigate risk.

`Credit & Risk Management`
For B2B (Business-to-Business)transactions, terms are directly tied to evaluating a buyer’s creditworthiness to ensure the seller minimizes bad debt.
__(will discuss more once approved)__
