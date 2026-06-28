# LINKO Roadmap

## Purpose

LINKO is a supply chain management platform for MSMEs that centralizes supplier discovery, logistics coordination, shipment visibility, and inventory-related workflows. The goal is to help growing businesses manage stock, coordinate fulfillment, discover reliable wholesalers, build ongoing buyer-wholesaler relationships, and make supply-chain decisions with better visibility.

This roadmap is the central planning document for the project. It defines the product direction, major development phases, milestones, and feature goals while keeping the early build simple enough to grow step by step.

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

- Build step by step, starting with a focused web application.
- Keep the early codebase simple and understandable.
- Design features so they can later support mobile apps and shared backend services.
- Prefer clear business workflows over excessive technical abstraction.
- Treat inventory, supplier discovery, orders, logistics coordination, and matching as core product domains.
- Keep documentation close to product decisions so future contributors understand why choices were made.

## Target Users

- MSME owners managing purchasing, stock, and supplier relationships.
- Warehouse staff tracking incoming and outgoing inventory.
- Wholesalers looking for qualified buyers and repeat buyer relationships.
- Retailers or business buyers searching for wholesalers.
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

For the minimum viable product (MVP), match MSMEs or buyers with wholesalers using only location and proximity. Merchandise type, product category, capacity, price, reliability, and other advanced criteria are deferred until the basic matching workflow has been validated.

### Orders and Fulfillment

Manage quote requests, wholesaler quotes, confirmed orders, shipment status, delivery confirmation, and issue tracking.

### Client Acquisition

Help wholesalers receive leads, manage inquiries, respond to buyer needs, and convert qualified matches into ongoing business relationships.

### Logistics Coordination

Track shipment details, delivery status, warehouse dispatches, carrier information, and fulfillment timelines.

### Analytics

Provide simple insights such as low-stock alerts, wholesaler performance, order volume, lead conversion, fulfillment delays, and inventory movement trends.

## Development Phases

## Phase 0: Project Foundation

Goal: Establish the project direction and basic development setup.

Milestones:

- Create initial React application.
- Add this roadmap as the strategic planning document.
- Define product name, target users, and core problem areas.
- Create an initial README with project purpose and setup steps.
- Establish basic routing and page layout.
- Decide initial styling approach.

Success criteria:

- The project can run locally.
- The first screen communicates the platform purpose.
- The repo has enough documentation for future development decisions.

## Phase 1: Minimum Usable Web App

Goal: Build a simple web dashboard that demonstrates the main platform concept.

Core features:

- Landing or dashboard page.
- Basic navigation.
- Inventory list page.
- Wholesaler directory page.
- Wholesaler detail page.
- Basic order or request page.
- Static sample data for inventory, wholesaler profiles, and orders.

Milestones:

- Create reusable layout components.
- Display inventory records from local sample data.
- Display wholesaler profiles from local sample data.
- Add basic filtering or searching for wholesalers.
- Add basic inventory status labels such as In Stock, Low Stock, and Out of Stock.

Success criteria:

- A user can understand what LINKO does by clicking through the app.
- Inventory and wholesaler data are represented clearly.
- The UI works on desktop and mobile screen sizes.

## Phase 2: Data Modeling and Local State

Goal: Define the first stable shape of the product data before adding a backend.

Core features:

- Product model.
- Warehouse model.
- Wholesaler-facing supplier model.
- Business profile model.
- Order or purchase request model.
- Location and proximity matching model.

Milestones:

- Move sample data into organized files.
- Define clear fields for inventory items and wholesaler-facing supplier profiles.
- Add local create, edit, and delete flows where useful.
- Add form validation for important fields.
- Document the initial data model.

Success criteria:

- Data structures are understandable and consistent.
- The app can simulate basic platform workflows without a backend.
- Future backend API design has a clear starting point.

## Phase 3: Inventory and Warehouse Workflows

Goal: Make inventory tracking useful enough for real operational demos.

Core features:

- Add inventory item creation and editing.
- Track quantity, unit, SKU, category, location, and status.
- Add stock movement records.
- Add reorder thresholds.
- Add warehouse or storage location views.
- Add low-stock alerts.

Milestones:

- Build inventory dashboard summary.
- Add inventory movement history.
- Add warehouse-specific stock views.
- Add search and filters by category, status, and warehouse.
- Add export-friendly table layout.

Success criteria:

- A business can see what products exist, where they are stored, and which items need attention.
- Inventory screens remain usable on mobile.

## Phase 4: Supplier Directory and Discovery

Goal: Build the supplier marketplace foundation.

Core features:

- Wholesaler profile management.
- Wholesaler categories.
- Product or service listings.
- Location and service area fields.
- Minimum order quantity.
- Lead time.
- Payment or fulfillment terms.
- Verification status.

Milestones:

- Build wholesaler directory with filters.
- Add wholesaler detail pages.
- Add wholesaler comparison fields.
- Add basic inquiry or contact action.
- Add wholesaler trust indicators such as verified, response rate, or fulfillment rating.

Success criteria:

- Buyers can browse and compare wholesalers.
- Wholesalers can be represented in a way that supports future matching.

## Phase 5: Supplier Matching [Status: Deferred (Post-MVP)]

Goal: Introduce a minimum matching workflow that connects buyers with nearby wholesalers.

Core features:

- Buyer requirement form.
- Location and proximity-based recommendation ranking.
- Distance or proximity match reasons.
- Wholesaler shortlist.
- Request quote flow.
- Match status tracking.

Milestones:

- Define the buyer and wholesaler location data required for proximity matching.
- Implement simple location and proximity-based matching.
- Show why a wholesaler was recommended.
- Allow users to save or shortlist wholesalers.
- Add basic quote request workflow.

Success criteria:

- The platform can recommend wholesalers based on location and proximity.
- Users can understand why each match appears.
- Matching logic is simple enough to improve over time.

MVP scope decision: Merchandise type, product category, capacity, pricing, reliability, and other advanced matching criteria are out of scope for the initial implementation. These may be added later only when user needs justify the additional data collection and maintenance workload.

## Phase 6: Orders, Quotes, and Client Acquisition [Status: Deferred (Post-MVP)]

Goal: Connect discovery and matching to real business workflows.

Core features:

- Quote requests.
- Wholesaler responses.
- Order creation.
- Order status tracking.
- Buyer and wholesaler communication history.
- Lead pipeline for wholesalers.

Milestones:

- Add quote request form.
- Add quote status states.
- Add order detail page.
- Add wholesaler lead dashboard.
- Add buyer request history.

Success criteria:

- Buyers can move from supplier discovery to request and order.
- Wholesalers can track incoming opportunities.
- Platform value becomes clearer for both sides of the marketplace.

## Phase 7: Logistics Coordination [Status: Deferred (Post-MVP)]

Goal: Add fulfillment and delivery visibility.

Core features:

- Shipment records.
- Dispatch status.
- Delivery status.
- Carrier or logistics partner details.
- Estimated delivery dates.
- Delivery issue tracking.

Milestones:

- Add shipment status timeline.
- Connect orders to shipment records.
- Add warehouse dispatch workflow.
- Add delivery confirmation state.
- Add simple logistics dashboard.

Success criteria:

- Users can see where an order is in the fulfillment process.
- Warehouse and logistics data are connected to inventory and orders.

## Phase 8: Backend and Authentication [Status: Deferred (Post-MVP)]

Goal: Move from local demo data to real persistent user data.

Core features:

- User authentication.
- Business accounts.
- Role-based access.
- Database persistence.
- API layer.
- Server-side validation.

Milestones:

- Choose backend stack.
- Create database schema.
- Add login and registration.
- Add business profile setup.
- Connect inventory to backend.
- Connect suppliers and orders to backend.

Success criteria:

- Data persists across sessions.
- Different user roles can access appropriate workflows.
- The app is ready for controlled testing with real users.

## Phase 9: Mobile-Friendly Expansion [Status: Deferred (Post-MVP)]

Goal: Prepare the platform for mobile app development without forcing a premature rewrite.

Core features:

- Responsive web workflows.
- Mobile-first inventory actions.
- Mobile-friendly wholesaler browsing.
- Field-friendly order and shipment updates.
- Shared business logic where practical.

Milestones:

- Audit all major screens on mobile widths.
- Simplify high-frequency workflows for small screens.
- Identify logic that should later be shared with a mobile app.
- Document future mobile app requirements.

Success criteria:

- The web app is comfortable to use on mobile browsers.
- Future React Native or Expo work has a clear path.

## Phase 10: Platform Hardening and Growth [Status: Deferred (Post-MVP)]

Goal: Improve reliability, trust, performance, and marketplace quality.

Core features:

- Admin dashboard.
- Wholesaler verification workflow.
- Notifications.
- Audit logs.
- Analytics.
- Performance optimization.
- Security review.
- Testing strategy.

Milestones:

- Add admin moderation tools.
- Add email or SMS notifications.
- Add automated tests for core workflows.
- Add analytics dashboard.
- Add error monitoring and logging.
- Prepare deployment documentation.

Success criteria:

- The platform can support real users with greater confidence.
- Operational risks are visible and manageable.
- The product is ready for pilot customers or staged launch.

## Suggested Initial Build Order

1. Create the React app.
2. Build a basic layout and navigation.
3. Add dashboard page.
4. Add inventory page using sample data.
5. Add wholesaler directory using sample data.
6. Add wholesaler detail page.
7. Add simple wholesaler search and filtering.
8. Add order or quote request mock flow.
9. Add responsive mobile styling.
10. Document the first data model.

## Near-Term Backlog

- Define initial app pages.
- Create visual identity and UI style direction.
- Add mock inventory records.
- Add mock wholesaler records.
- Add mock order or quote records.
- Build reusable table, card, badge, and form components.
- Add empty states and loading states.
- Add mobile navigation.
- Define location and proximity data for MVP wholesaler matching.
- Add README setup instructions.

## Future Technical Direction

The project can start as a simple React app. As the product grows, the repo may evolve toward:

- A dedicated backend API.
- A persistent database.
- Shared validation and domain logic.
- A mobile app.
- Admin tools.
- Automated testing.
- Deployment infrastructure.

This should happen only when the product needs justify the additional structure.

## Open Questions

- Which user group should be served first: MSME buyers, wholesalers, warehouse staff, or platform admins?
- Should the first version focus more on inventory tracking or wholesaler discovery?
- What country, region, or market should the first supplier matching rules target?
- Will logistics tracking be manual at first or integrated with delivery providers?
- What wholesaler verification process is required?
- What location format, distance unit, and proximity radius should the first matching rules use?

## Current Status

Status: Planning and foundation.

Next recommended milestone: Create the initial React application and build a small demo experience with inventory, wholesaler, and order sample data.
