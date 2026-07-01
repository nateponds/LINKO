# LINKO Glossary

This glossary defines the canonical terms developers and agents should use when designing, documenting, or implementing LINKO.

If multiple documents use different words for the same idea, prefer the definition in this file. When the codebase evolves, update this glossary so product language, API naming, database naming, and UI labels stay aligned.

## Product Definition

### LINKO
LINKO is a supply chain management platform for MSMEs that centralizes supplier discovery, logistics coordination, shipment visibility, and inventory-related workflows.

### Platform
In LINKO, "platform" refers to the overall product and ecosystem, not only the web app UI. It includes the marketplace, workflow logic, operational data, and future backend services.

### MVP
MVP means the first intentionally limited version of LINKO. In the current roadmap, the MVP keeps workflows simple, especially in supplier matching, where only location and proximity are used for recommendations.

## Core User and Business Terms

### MSME
MSME is the canonical term for LINKO's primary target customer segment.

It stands for Micro, Small, and Medium Enterprise. In product language, this usually refers to the business that uses LINKO to manage procurement, stock visibility, supplier relationships, and related operations.

### Buyer
Buyer is the transactional role for the demand-side participant seeking products, supplies, or supplier connections through LINKO.

Use `buyer` when describing matching, requests, quotes, and orders. A buyer will often be an MSME, but `buyer` describes the role in a workflow while `MSME` describes the customer segment.

### Business
Business is the broad legal or organizational entity represented in LINKO.

Use `business` as the umbrella term in data models and system relationships. A business may act as a buyer, a wholesaler, or both depending on the workflow.

### Business Owner
Business owner refers to the human operator or representative of an MSME or other business using LINKO.

Use this term for user personas, onboarding, and business-plan language. Do not use it as a substitute for `buyer` in transactional flows.

### Client
Client is not the preferred canonical term for LINKO's demand-side actor.

Use `buyer` for procurement and marketplace workflows instead. Reserve `client` only when describing a wholesaler's external customer relationship in business or sales language.

## Supply-Side Terms

### Supplier
Supplier is the broad umbrella term for an entity that provides products or services into the supply chain.

Not every supplier in the abstract LINKO ecosystem is necessarily the main marketplace target for the MVP. Use this term when speaking generally about supply-side actors, data relationships, or future platform scope.

### Wholesaler
Wholesaler is the preferred canonical term for the supply-side marketplace participant LINKO is specifically targeting when that actor supplies directly to MSMEs.

Use `wholesaler` when the distinction matters and the business is selling directly to MSME buyers through discovery, matching, quotes, or orders. This helps separate LINKO's intended marketplace partner from broader upstream suppliers that may supply other suppliers.

### Wholesale Provider
Wholesale provider is an acceptable descriptive synonym for `wholesaler`, but `wholesaler` should be treated as the primary term in product and glossary language.

### Supplier Profile
Supplier profile is the system representation of a supply-side business's commercial details.

In current database and API documents, this profile includes details such as minimum order quantity, lead time, delivery terms, trust rating, and verification status. Even if the preferred actor label is `wholesaler`, existing schema names such as `Supplier_Profiles` remain valid until intentionally renamed.

### Verified Supplier / Verified Wholesaler
A verified supplier or verified wholesaler is a supply-side business that has passed platform trust or review checks.

Use this as a business or UX concept, not as a replacement for the underlying data fields that track verification.

## Operational and Domain Terms

### Inventory
Inventory is the domain concerned with products, stock levels, units, SKUs, categories, reorder thresholds, and availability.

Use `inventory` for both the product domain and the operational data associated with stored stock.

### Product
Product is the catalog-level item definition in LINKO.

A product describes what the item is. It is distinct from the physical quantity of that product stored in a specific warehouse.

### Inventory Item
Inventory item is the stock record that maps a product to a warehouse or storage context with quantity and operational thresholds.

In the database specification, this is the operational stock record rather than the abstract product definition.

### Inventory Transaction
Inventory transaction is the audit record of stock movement or stock mutation.

Examples include inbound stock, outbound stock, adjustments, and transfers.

### Warehouse
Warehouse is the canonical term for a physical or operational storage location in LINKO.

Use `warehouse` as the primary operational term in code, API contracts, database models, and docs unless a future design intentionally splits the concept further.

### Storage Location
Storage location is a sub-location or placement concept inside or associated with a warehouse.

It should not be used as a broad synonym for `warehouse` when the larger facility or operational node is meant.

### Hub
Hub is a related logistics term, but not the preferred canonical term for the core storage entity.

Use `hub` only when the business context specifically refers to a routing, transfer, or logistics point rather than the general warehouse model.

### Branch
Branch is an organizational or site term and should not be treated as a default synonym for `warehouse`.

Use it only when the business context refers to a business location or branch office rather than the warehouse entity itself.

### Logistics Coordination
Logistics coordination is a core LINKO domain covering shipment and fulfillment visibility, even though it is currently deferred post-MVP in the roadmap.

This domain includes shipment records, dispatch status, delivery status, carrier or partner details, and fulfillment timelines. In planning language, mark it as a core domain with deferred implementation.

### Shipment
Shipment is the fulfillment or delivery unit being tracked through logistics workflows.

Use `shipment` when referring to dispatch, route visibility, delivery status, and logistics updates.

### Fulfillment
Fulfillment is the operational process of moving from confirmed order to successful delivery or completion.

It may involve warehousing, dispatch, delivery tracking, and issue handling.

### Dispatch
Dispatch is the act or workflow of sending goods out from a warehouse, storage point, or fulfillment operation.

### Delivery Status
Delivery status is the current reported state of a shipment in transit or at completion.

### Shipment Visibility
Shipment visibility is the user-facing ability to monitor the status or route progress of a shipment.

This is a major value proposition in the business plan and should be treated as a first-class product concept.

## Marketplace and Matching Terms

### Supplier Discovery
Supplier discovery is the workflow where buyers browse, search, filter, and inspect supplier or wholesaler listings.

Discovery is user-driven exploration. It is not the same as system-generated recommendation logic.

### Supplier Matching
Supplier matching is the workflow where LINKO recommends or connects buyers with relevant suppliers or wholesalers based on defined rules.

For the current MVP direction, matching should use only location and proximity. Advanced criteria such as product category, price, reliability, capacity, and performance are intentionally deferred.

### Match
A match is a supplier or wholesaler result that LINKO presents to a buyer as relevant to the buyer's request or context.

### Match Reason
Match reason is the explanation shown for why a supplier or wholesaler was recommended.

For the MVP, this should usually be tied to location, service area, distance, or proximity.

### Proximity Matching
Proximity matching is the initial matching logic that ranks or filters candidate wholesalers based on geographic closeness or service-area relevance to the buyer.

This is the canonical MVP matching approach.

### Service Area
Service area is the geographic region a supplier or wholesaler can serve operationally.

### Coverage Area
Coverage area is closely related to `service area` and can be treated as equivalent unless a future implementation gives them separate meanings.

### Marketplace
Marketplace refers to the LINKO environment where buyers and supply-side businesses discover each other, connect, and move into commercial workflows.

## Commercial Workflow Terms

### Inquiry
Inquiry is an initial buyer-to-supplier contact or expression of interest before a formal quote or order exists.

### Quote Request
Quote request is the formal buyer request asking a supplier or wholesaler for terms, pricing, or fulfillment details.

### Quote
Quote is the supplier or wholesaler response defining proposed commercial terms for a buyer request.

### Order
Order is the confirmed commercial record created once a buyer and supplier or wholesaler move beyond a quote into an agreed transaction.

### Order Status
Order status is the tracked state of an order as it moves through confirmation, fulfillment, and completion.

### Default Business Flow
The default LINKO commercial flow is:

`supplier discovery or supplier matching -> inquiry or quote request -> supplier response or quote -> order -> shipment -> inventory update`

This is the canonical high-level workflow unless a feature explicitly introduces a variant.

## Trust, Verification, and Ratings

### Verification
Verification is the business concept of checking whether a supply-side participant has met platform trust requirements.

### `is_verified`
`is_verified` is the simple boolean-style field indicating whether a business is verified at a high level.

Use this term when the implementation needs a true-or-false summary.

### `verification_status`
`verification_status` is the richer lifecycle field that stores a more specific verification state such as `pending`, `verified`, or `rejected`.

Use this when the implementation needs more than a boolean.

### `trust_rating`
`trust_rating` is the reputation or performance-oriented rating value associated with a supplier or wholesaler profile.

It is not the same as verification. A participant may have a rating concept and a verification concept at the same time.

## Technical and Documentation Terms

### Domain
Domain means a major functional area of the product and system, such as Inventory, Suppliers, Supplier Matching, Orders, or Logistics.

### API Contract
API contract is the agreed request and response shape between frontend and backend for a given endpoint or workflow.

### Data Model
Data model is the agreed structural representation of core entities, fields, and relationships before or during implementation.

### Canonical Term
A canonical term is the preferred term that developers and agents should use when multiple near-synonyms exist in the repo.

### Deferred
Deferred means intentionally planned for a later phase and not part of the current implementation target.

A deferred concept may still appear in the glossary if it is a core part of LINKO's long-term domain model.

## Canonical Language Rules

- Prefer `MSME` for the primary target customer segment.
- Prefer `buyer` for the demand-side workflow role.
- Prefer `business` for the umbrella entity in models and relationships.
- Prefer `wholesaler` for the supply-side marketplace actor that sells directly to MSMEs.
- Use `supplier` as the broader umbrella term when speaking generally about the ecosystem.
- Treat `supplier discovery` and `supplier matching` as separate workflows.
- Prefer `warehouse` as the main operational storage term.
- Treat `logistics coordination` as a core but currently deferred domain.
- Keep MVP matching scoped to `location` and `proximity` unless the roadmap and related docs are intentionally updated.
