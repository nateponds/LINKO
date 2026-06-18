# Backend Guide

## Purpose

This document guides the backend planning and implementation for LINKO. The project is currently in active early development, with backend work focused on defining the core data models, API responsibilities, authentication needs, and service boundaries that will support the platform as it grows.

LINKO is intended to support logistics coordination, warehouse inventory tracking, supplier discovery, supplier matching, client acquisition, and supply-chain operations for MSMEs and wholesale providers.

## Current Development Stage

The backend is not expected to be fully implemented immediately. At this stage, the goal is to prepare a clear technical direction so backend development can proceed step by step alongside the frontend design phase.

The first backend work should focus on:

- Understanding the core business domains.
- Defining stable data models.
- Planning API endpoints.
- Identifying authentication and authorization requirements.
- Preparing for future database integration.
- Keeping backend decisions aligned with `ROADMAP.md`.

## Core Backend Domains

### Authentication and Users

Responsible for user registration, login, sessions, account management, and role-based access.

Expected user roles may include:

- MSME owner
- Supplier
- Warehouse staff
- Logistics coordinator
- Platform administrator

### Businesses

Represents companies or organizations using LINKO.

This domain should support:

- Business profile information
- Business type
- Contact details
- Location
- Verification status
- Linked users

### Inventory

Responsible for products, stock levels, SKUs, categories, units, reorder thresholds, and stock availability.

This domain should eventually support:

- Inventory item creation
- Inventory updates
- Stock adjustments
- Low-stock detection
- Stock movement history
- Warehouse-specific availability

### Warehouses

Represents physical or operational storage locations.

This domain should eventually support:

- Warehouse profiles
- Storage locations
- Inventory assignment
- Receiving workflows
- Dispatch workflows
- Stock transfers

### Suppliers

Responsible for supplier profiles and wholesale provider information.

This domain should eventually support:

- Supplier business profiles
- Product or service categories
- Minimum order quantity
- Lead time
- Coverage area
- Fulfillment capability
- Verification status
- Supplier ratings or performance indicators

### Supplier Matching

Responsible for connecting buyer requirements with supplier capabilities.

This domain should eventually support:

- Buyer requirement submission
- Matching criteria
- Match scoring
- Match reasons
- Supplier shortlists
- Quote request creation

### Orders and Quotes

Responsible for quote requests, supplier responses, confirmed orders, and order status tracking.

This domain should eventually support:

- Quote request creation
- Supplier quote responses
- Order confirmation
- Order status changes
- Buyer and supplier order history
- Issue tracking

### Logistics

Responsible for shipment and fulfillment coordination.

This domain should eventually support:

- Shipment records
- Dispatch status
- Delivery status
- Carrier or logistics partner data
- Estimated delivery dates
- Delivery confirmation
- Fulfillment delays or issues

### Notifications

Responsible for communicating important updates to users.

This domain may eventually support:

- Email notifications
- SMS notifications
- In-app alerts
- Low-stock alerts
- Order status updates
- Supplier inquiry updates

### Analytics

Responsible for operational and marketplace insights.

This domain may eventually support:

- Inventory movement trends
- Low-stock reports
- Supplier performance
- Quote conversion
- Order volume
- Fulfillment delays
- Client acquisition metrics

## Suggested Initial Data Models

The first backend planning should define rough models for:

- User
- Business
- InventoryItem
- Warehouse
- SupplierProfile
- SupplierProduct
- MatchRequest
- MatchResult
- QuoteRequest
- Order
- Shipment
- Notification

These models do not need to be final yet. They should be clear enough to guide frontend mock data, API planning, and database design.

## Suggested API Areas

Initial API planning can be grouped like this:

```text
/api/auth
/api/users
/api/businesses
/api/inventory
/api/warehouses
/api/suppliers
/api/matching
/api/quotes
/api/orders
/api/logistics
/api/notifications
/api/analytics
```

Example future endpoints:

```text
GET    /api/inventory
POST   /api/inventory
GET    /api/inventory/:id
PATCH  /api/inventory/:id
DELETE /api/inventory/:id

GET    /api/suppliers
POST   /api/suppliers
GET    /api/suppliers/:id
PATCH  /api/suppliers/:id

POST   /api/matching/requests
GET    /api/matching/requests/:id/results

POST   /api/quotes
GET    /api/quotes
PATCH  /api/quotes/:id/status

POST   /api/orders
GET    /api/orders
GET    /api/orders/:id

POST   /api/logistics/shipments
GET    /api/logistics/shipments/:id
PATCH  /api/logistics/shipments/:id/status
```

## Authentication and Authorization Notes

The backend should eventually support role-based access control.

Example permissions:

- MSME users can manage their own inventory, quote requests, and orders.
- Suppliers can manage their own supplier profile, quote responses, and leads.
- Warehouse staff can update stock movements and dispatch information.
- Logistics users can update shipment status.
- Admins can manage users, verify suppliers, and review platform activity.

Authorization should be enforced on the backend, not only in the frontend UI.

## Database Planning Notes

The database should be designed around business workflows, not only screens.

Important relationships to consider:

- A user belongs to one or more businesses.
- A business may own inventory.
- A business may also be a supplier.
- A supplier may list many products or services.
- A warehouse contains many inventory items.
- Inventory items may have movement history.
- A buyer may create many quote requests.
- A quote request may produce several supplier matches.
- A quote may become an order.
- An order may have one or more shipments.

## Backend Development Priorities

Recommended order:

1. Define initial data models.
2. Choose backend stack.
3. Choose database.
4. Create basic API structure.
5. Add authentication.
6. Add business profiles.
7. Add inventory endpoints.
8. Add supplier endpoints.
9. Add quote or order endpoints.
10. Add supplier matching logic.
11. Add logistics tracking.
12. Add notifications and analytics.

## Matching Logic Notes

The first matching system should be simple and explainable.

Possible matching criteria:

- Product category
- Required quantity
- Buyer location
- Supplier service area
- Minimum order quantity
- Lead time
- Price range
- Supplier verification status
- Fulfillment capability
- Past performance

The system should show why a supplier was recommended. Early matching can be rule-based before any advanced scoring or machine learning is considered.

## Integration Notes

Future backend integrations may include:

- Email service
- SMS service
- Maps or geolocation provider
- Payment provider
- Accounting software
- Logistics or carrier APIs
- File storage for documents and product images

These should be added only when product workflows require them.

## Testing Expectations

Backend testing should eventually cover:

- Authentication
- Authorization rules
- Inventory updates
- Supplier profile updates
- Match request creation
- Quote and order status changes
- Shipment status updates
- Validation errors
- Permission errors

## Notes for Backend Developers

- Keep the first implementation simple and readable.
- Avoid overengineering before the product workflow is clear.
- Document important API and database decisions.
- Coordinate with frontend developers before changing response shapes.
- Treat `ROADMAP.md` as the product direction source.
- Treat `FRONTEND_GUIDE.md` as context for the current UI and page structure.
- Backend security and data ownership rules should be planned early, even if implementation comes later.
