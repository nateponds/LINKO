# LINKO Courier & Parcel Tracking System — Functional Requirements

Derived from the corrected Use-Case model (`LINKO_USE-CASE.md`, `LINKO_USE-CASE_Requirements.md`),
the Logistics Subsystem ERD (`LINKO_ERD.md`), and the LINKO Reconnaissance & Beta Test Report.

> **How to read this section.** Requirements are grouped by functional area and written as
> *"The system shall…"*. Each requirement carries an identifier (`FR-<area>.<n>`) for traceability.
> Access constraints reference the roles defined in §1.

---

## 1. Overview & Actor Roles

LINKO is a buyer–wholesaler marketplace built around a courier/parcel-tracking core. The system
recognizes five user classes, enforced by role-based access control (RBAC):

| Role | Description |
|---|---|
| **Buyer** | Discovers wholesalers, places orders, and tracks deliveries of their own parcels. In the logistics subsystem, a buyer's business is the parcel **Receiver**. |
| **Wholesaler** | Manages inventory, fulfills orders, and ships parcels. In the logistics subsystem, a wholesaler's business is the parcel **Sender**. |
| **Logistics Coordinator** | Manages branches, couriers, and routing; performs correction/override actions including parcel cancellation. |
| **Courier** | Updates delivery status for assigned parcels through the tracking state machine. |
| **Platform Administrator** | Manages user accounts and business verification across the whole platform. |

The use-case diagram models the logistics subsystem with the ERD's **Sender / Receiver / Courier /
Administrator** actors. The mapping above ties those parcel-level roles to the product's
marketplace roles.

---

## 2. Account & Session Management

- **FR-1.1** The system shall let a visitor register an account by providing full name, email, password, business name, and business type (buyer or wholesaler), creating the user, business, and membership in a single transaction.
- **FR-1.2** The system shall authenticate users by email and password, returning a generic error for both invalid credentials and deactivated accounts (to prevent account enumeration).
- **FR-1.3** The system shall maintain an authenticated session via a secure, HttpOnly session cookie with a fixed 7-day lifetime.
- **FR-1.4** The system shall allow an authenticated user to log out, invalidating their session.
- **FR-1.5** The system shall expose the current session's user, roles, and active business to the client as the single source of session truth.
- **FR-1.6** The system shall enforce that a single business cannot simultaneously hold both the buyer and wholesaler marketplace roles.

## 3. Business Context & Access Control

- **FR-2.1** The system shall support users belonging to multiple businesses and shall let such users select an **active business** for the current session.
- **FR-2.2** The system shall validate the caller's active-business context on every request against their actual memberships and reject mismatches.
- **FR-2.3** The system shall scope every data read and write to the caller's active business (row-level ownership), preventing access to other businesses' parcels, orders, products, or invoices.
- **FR-2.4** The system shall redirect users away from routes their role does not permit, and reject unauthorized API calls with an access-denied response.

## 4. Marketplace Discovery

- **FR-3.1** The system shall let any authenticated user browse a catalog of wholesalers and their products.
- **FR-3.2** The system shall let users filter and search products by category.
- **FR-3.3** The system shall present a wholesaler profile page showing that supplier's details and product listings.

## 5. Inventory Management (Wholesaler)

- **FR-4.1** The system shall let a wholesaler view, create, and update products belonging to their active business.
- **FR-4.2** The system shall derive and display each product's stock status from its quantity relative to a reorder threshold.
- **FR-4.3** The system shall prevent a wholesaler from modifying another business's products.

## 6. Order Management

- **FR-5.1** The system shall let a buyer place an order against a wholesaler, recording line items and computing the order total.
- **FR-5.2** The system shall let a wholesaler accept a pending order.
- **FR-5.3** The system shall let a wholesaler ship an accepted order, requiring the actual handoff weight to be recorded at ship time (not at checkout).
- **FR-5.4** The system shall let either party cancel an order before it reaches a terminal state, notifying the counterparty.
- **FR-5.5** The system shall advance orders through the defined lifecycle: *pending → accepted → preparing → shipped → delivered*, with *cancelled* / *returned* as alternate outcomes.

## 7. Invoicing & Payment

- **FR-6.1** The system shall generate an invoice for each order, with the invoice amount frozen at booking as *declared value + shipping fee*.
- **FR-6.2** The system shall let the relevant parties view invoices scoped to their active business.
- **FR-6.3** The system shall record exactly one payment per parcel and settle it according to method — prepaid at booking, cash-on-delivery on delivery or return. *(Payment is modeled and tracked, not payment-gateway enforced.)*

## 8. Parcel Registration & Shipping Fee — *UC1–UC3, UC11–UC12*

- **FR-7.1** The system shall register a parcel when a wholesaler ships an order, recording sender, receiver, service tier, weight, and declared value.
- **FR-7.2** The system shall generate a unique, collision-proof tracking number for every parcel at registration.
- **FR-7.3** The system shall calculate the shipping fee automatically at registration from the service tier's base fee, per-kilogram rate, and per-kilometer distance.
- **FR-7.4** The system shall create an initial "Order Created" tracking-log entry for every parcel at registration.
- **FR-7.5** The system shall resolve and snapshot the parcel's initial branch and planned route based on origin/destination location.

## 9. Parcel Tracking & Status Updates — *UC4–UC6, UC13*

- **FR-8.1** The system shall let a courier update the status of assigned parcels through the valid tracking state machine: *Order Created → Picked Up → Arrived at Branch → Departed Branch → Out for Delivery → Delivered*, plus the return path *Out for Return → Returned* triggered after three delivery failures.
- **FR-8.2** The system shall record every status update as an append-only tracking-log entry, keeping tracking history as the source of truth and surfacing the latest entry as the parcel's current status.
- **FR-8.3** The system shall reject invalid or out-of-sequence status transitions.
- **FR-8.4** The system shall auto-generate a proof-of-delivery remark on terminal (Delivered) scans.
- **FR-8.5** The system shall let a buyer track their own parcel and view its tracking history and details, while denying access to unrelated parcels.
- **FR-8.6** The system shall end a receiver's delivery timeline at the third delivery failure, while retaining full return-leg visibility for staff.

## 10. Courier, Branch & Routing Operations — *UC7, UC9, UC10*

- **FR-9.1** The system shall let a logistics coordinator create, update, and soft-delete branches.
- **FR-9.2** The system shall block hard-deletion of a branch while live parcels reference it.
- **FR-9.3** The system shall let a coordinator onboard couriers and assign each courier to a branch, disallowing assignment to an inactive branch.
- **FR-9.4** The system shall let a coordinator assign a courier to a parcel, and shall let a courier self-claim a parcel from the pool.
- **FR-9.5** The system shall route parcels to the nearest available branch by distance, falling back to a city match when the origin is unpinned.

## 11. Service Tier Management — *UC8*

- **FR-10.1** The system shall maintain service tiers (e.g., Standard, Express, Next-Day) with their fee parameters and estimated delivery days.
- **FR-10.2** The system shall make service tiers available for shipping-fee calculation and shall allow authorized staff to manage tier definitions.

## 12. Parcel Cancellation — *UC14*

- **FR-11.1** The system shall let a platform administrator (coordinator/admin override) cancel a parcel, recording the cancellation as a `Cancelled` tracking-log entry.
- **FR-11.2** The system shall treat `Cancelled` as an administrative override distinct from the courier's normal delivery-state flow; couriers shall not be able to produce a `Cancelled` state.

## 13. Notifications

- **FR-12.1** The system shall generate in-app notifications to the relevant counterparty on order and delivery lifecycle events.
- **FR-12.2** The system shall display an unread-notification count and let users open and mark notifications as read.

## 14. Dashboard & Analytics

- **FR-13.1** The system shall present a dashboard summarizing revenue, order counts, and top products for the active business.
- **FR-13.2** The system shall let users filter dashboard metrics by time range (today / 7 days / 30 days).
- **FR-13.3** The system shall surface a recent-activity feed and alert indicators for cancelled or returned items.

## 15. User Settings

- **FR-14.1** The system shall let a user view their profile and business memberships.
- **FR-14.2** The system shall let a business set its logistics location via map picker or numeric coordinates, and shall prompt the business while its location is unset.

## 16. Platform Administration

- **FR-15.1** The system shall let a platform administrator view all users and create logistics-coordinator, courier, and platform-administrator accounts.
- **FR-15.2** The system shall let a platform administrator deactivate and reactivate users, terminating a deactivated user's active sessions immediately.
- **FR-15.3** The system shall let a platform administrator view all businesses and toggle their verification status.

---

## 17. Out of Scope (by design)

The following are explicitly **not** functional requirements of this release, per the ERD scope
freeze and the reconnaissance report:

- **Commission collection / reversal workflow and wholesaler remittance UI** — commission and remittance data are report/ERD scope only; no application workflow is built.
- **Returns & refunds handling** — reversal semantics are deferred (`BACKLOG.md`).
- **Self-service password reset, email notifications, and two-factor authentication** — not implemented in this release.
- **Real payment-gateway settlement** — payment status is modeled and tracked, not gateway-enforced.
