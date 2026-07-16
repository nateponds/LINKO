# LINKO Demo Script

A guided walkthrough for evaluating LINKO. It runs **seven role journeys** end to end and
calls out exactly what to observe at each step — especially **role-based access control
(RBAC)** and **row-level ownership**, the two properties the platform is graded on, plus the
Sprint 8 workflow-integrity beats (honest ship-time weight, method-honest payment status,
proof-of-delivery remarks, and buyer delivery visibility).

## Before you start

- Accounts and password: see [`DEMO_ACCOUNTS.md`](./DEMO_ACCOUNTS.md).
  **Every account's password is `Password123!`.**
- Ensure the demo data is loaded (fresh state): from `backend/`, `npm run seed:demo`.
- Log in at `/login`. To switch accounts between journeys, use the profile menu **Log out**,
  then log in as the next account.
- **Business switcher:** the `bizswitch@linko.test` account owns **two separate businesses** — Metro Cebu Trading — Retail (buyer) and Metro Cebu Trading — Wholesale (wholesaler). When logged in as that user, a business switcher appears in the top bar — changing it changes the "active business" the backend scopes every request to. Sprint 9 replaced the prior single-"both"-business account with this two-business split, so a single business can never be both buyer and wholesaler at once. The five journeys below use the single-membership accounts for clarity.

Routes referenced below all exist in `src/App.jsx` and are protected by
`ROLE_ACCESS` role groups in `src/auth/roleAccess.js`.

---

## Journey 1 — Buyer: discover a wholesaler, place an order, view the invoice

**Log in as** `buyer@linko.test` (Sunrise Retail Cooperative).

1. You land on **Home** (`/`, Supplier Discovery). Observe the navigation only shows
   buyer-appropriate items — **no** *My Products* and **no** *Logistics management*.
2. Browse the wholesaler/product grid. Open a supplier by clicking a card
   (`/suppliers/:supplierId`) to review their profile and listings.
3. Go to **Find Wholesalers** (`/matching`). This is a discovery aid. *(This page is
   labeled "Demo data — not yet connected to the live backend"; the live catalog is on Home.)*
4. Go to **Orders** (`/orders`). You already have a seeded order from Cebu Fresh Wholesale.
   Note the status tabs (Pending / Accepted / Shipped / Delivered).
5. Open the pending order and confirm the line items and totals render.
6. Go to **Invoices** (`/invoices`) and open the invoice for an accepted/shipped/delivered
   order — confirm totals match the order items plus the service-tier fee.

**Grader should observe:**
- The buyer sees **only their own** business's orders and invoices (row-level ownership).
- Navigation and routes hide wholesaler/logistics/admin surfaces (RBAC).

---

## Journey 2 — Wholesaler: manage products/inventory, accept an order, create a shipment

**Log in as** `wholesaler@linko.test` (Cebu Fresh Wholesale).

1. Note the navigation now includes **My Products** — a wholesaler-only surface.
2. Go to **My Products / Inventory** (`/inventory`). Confirm you see **only Cebu Fresh
   Wholesale's** products (seeded 6 items), scoped to your active business.
3. Go to **Orders** (`/orders`). Here you see orders **placed to you** as the seller.
4. Open the **Pending** order (from Sunrise Retail) and use the action to **Accept** it.
   The status advances to *Accepted* (optimistic refetch updates the row).
5. Advance to *Preparing*, then click **Ship**. A **Ship order** modal opens and asks for the
   parcel's **weight (kg)** — this is required; submitting without it is rejected. Enter a real
   weight (e.g. `8.5`) and optional dimensions, then confirm. This is the honest-weight beat:
   the shipping fee stays the quote frozen at checkout, while the real weight is recorded
   **at handoff**. Shipping auto-creates the parcel (distance is left
   `NULL` — checkout never measured a route).
6. Confirm an invoice/shipment is associated with the progressed order (visible via the
   order detail and, for parcels, the logistics surface).

**Grader should observe:**
- The wholesaler's inventory and orders are **scoped to their business only** — they cannot
  see the other wholesaler's products.
- Only the **wholesaler** (not the buyer) can accept/advance an order they own.
- **Weight is recorded at the physical handoff**, not guessed at checkout — the ship action
  cannot proceed without it.

---

## Journey 3 — Logistics coordinator: manage branches/couriers, assign a courier

**Log in as** `logistics@linko.test` (LINKO Logistics Hub).

1. Note the navigation shows **Logistics** and hides marketplace-only items.
2. Go to **Logistics** (`/logistics`). Coordinators see **all** parcels in the network
   (seeded: one in-transit, one delivered), with status tabs and search.
3. Go to **Logistics management** (`/logistics/management`). Review the seeded **branches**
   (Cebu Central Hub, Mandaue Hub) and **couriers**.
4. Add a branch and/or a courier using the **Add** forms to show write access.
5. Open a parcel (`/logistics/:parcelId`) that is not yet delivered and **assign a courier**
   to it, moving it along the tracking chain.
6. Confirm the tracking log records the new event.

**Grader should observe:**
- Branch/courier endpoints are **authenticated** and role-gated — a logged-out user or a
  plain buyer cannot reach them (RBAC; this was a fixed ownership gap).
- The coordinator has network-wide visibility by design, unlike a courier (next journey).

---

## Journey 4 — Courier: update statuses through to delivered

**Log in as** `courier@linko.test` (Cory Courier, Cebu hub).

1. Land on **Courier Dashboard** (`/courier`) — a courier-only route.
2. Confirm you see **only parcels assigned to you** (not the whole network) — this is the
   ownership scope that distinguishes a courier from a coordinator.
3. Use a **quick action** on an assigned parcel to record the next status — the buttons are
   derived from the transition map (*Picked Up* → *Arrived at Branch* → *Departed Branch* →
   *Out for Delivery*). Every action is one tap with a fixed remark; **Delivery Failed**
   swaps in a canned reason pick-list (nobody home / refused / bad address) — no free text.
4. Open the parcel detail (`/logistics/:parcelId`) to see the tracking history update.
5. Record **Delivered** on the final parcel. The proof-of-delivery remark is
   **auto-generated from accounts** ("{courier name} → {receiver business}") — no typing.
6. Return path: after **3× Delivery Failed** the retry option closes. The locked path is
   **Arrived at Branch → Out for Return → Returned**. `Out for Return` means the parcel left
   the return branch for the wholesaler; `Returned` means the wholesaler physically received
   it. Seeded parcel `LKO-00000003` carries the full journey.
7. Re-open the parcel to confirm the full tracking chain and the generated proof of return
   (`courier → sender business`) on the terminal event.

**Grader should observe:**
- A courier is **scoped to assigned parcels only** (row-level ownership) — they cannot
  view or update parcels assigned to another courier.
- Status updates append to the tracking log with the courier/branch recorded.
- **Terminal courier scans carry generated evidence** — Delivered names the receiver
  business; Returned names the sender business. Courier free text cannot replace it.

---

## Journey 5 — Buyer: track a delivery from the order screen

**Log in as** `buyer@linko.test` (Sunrise Retail Cooperative).

1. Go to **Orders** (`/orders`). On a **shipped / delivered / returned** order, a
   **Track parcel** action appears in the row.
2. Click it. A read-only **tracking modal** opens showing the parcel number, current status,
   and the full tracking timeline (handled-by-branch and delivered-to-destination lines
   included). The buyer answers "where is my order?" **without ever entering the logistics
   workspace**.
3. Confirm the buyer has **no** Logistics nav item and cannot reach `/logistics` — the modal
   is their only delivery visibility.
4. *(Optional, multi-business check)* Log in as `bizswitch@linko.test`, switch the top-bar business to **Metro Cebu Trading — Retail** (the buyer side), and confirm the buyer-side parcel is visible via its order's Track modal — while the operator parcel **list** stays empty for the buyer context. Then switch to **Metro Cebu Trading — Wholesale** (the wholesaler side) and confirm the parcel list becomes populated — the two contexts are fully isolated.

**Grader should observe:**
- A buyer reads exactly **one parcel — their own delivery** — via `GET /api/parcels/:id`
  (visible because they are the receiver). An unrelated parcel returns **404**.
- The parcel **list** is operator-only: a buyer-only session sees an empty list. Buyer
  visibility does not leak the network or grant logistics workspace access.

---

## Journey 6 — Coordinator correction (operational escape hatch)

**Log in as** `logistics@linko.test` (LINKO Logistics Hub).

1. Open a parcel and record a terminal event (e.g. **Delivered**) **without** remarks. Unlike
   the courier path, the coordinator/admin **is allowed** to log it — this is the deliberate
   correction escape hatch for fixing operational mistakes.
2. Note the COD payment behavior: on a **COD** parcel, a **Delivered** scan settles the payment
   to *Paid*; a **Returned** scan marks it *Failed*. A coordinator correction after a terminal
   scan does **not** rewrite an already-settled payment (the update is guarded on `Pending`).

**Grader should observe:**
- POD remarks are enforced for **courier** scans but **not** coordinators/admins — preserving
  the correction path (documented in `docs/API_CONTRACTS.md §3.6`).
- **Payment status moves honestly by method**: Prepaid/Online settle at booking; COD settles
  on delivery and fails on return. The payment→dispatch gate stays **modeled, not enforced**
  (course-deliverable scope).

---

## Journey 7 — Platform admin: user and business management

**Log in as** `admin@linko.test` (LINKO Platform).

1. Note the navigation includes **Admin** — visible **only** to the platform admin
   (`global_role = 'platform_admin'`), never to any membership role.
2. Go to **Admin** (`/admin`, Admin Dashboard). Review the **Users** table: name, email,
   role summary, active badge, and inline memberships.
3. Use **Create user** to add a privileged account — choose a `kind` of *courier* or
   *logistics_coordinator* (select a business) or *platform_admin*. Submit and confirm the
   new user appears in the table.
4. **Verify RBAC end to end:** log out and log in as the new courier/coordinator with the
   password you set — confirm they land on their role's dashboard and nothing more.
5. Back as admin, **Deactivate** a user via the toggle. Confirm the active badge flips and
   their sessions are cleared (a deactivated user cannot log in — 401).
6. **Reactivate** the same user to restore access.
7. Open the **Businesses** table and toggle **verified** on a business; confirm the badge updates.

**Grader should observe:**
- The `/admin` surface and `/api/admin/*` endpoints are gated by
  `requireGlobalRole('platform_admin')` — a non-admin gets **403** (RBAC).
- Admin actions have real effects: creating privileged users, deactivation killing sessions,
  and business verification toggles all persist and are reflected on login behavior.

---

## Quick reference — routes by role

| Route | Roles allowed | Journey |
| --- | --- | --- |
| `/` , `/suppliers`, `/suppliers/:id` | buyer, wholesaler, admin | 1 |
| `/matching` | buyer, admin | 1 |
| `/orders`, `/invoices` | buyer, wholesaler, admin | 1, 2, 5 |
| `/inventory` | wholesaler, admin | 2 |
| `/logistics`, `/logistics/management`, `/logistics/:parcelId` | wholesaler, logistics_coordinator, courier, admin | 3, 4, 6 |
| `/courier` | courier | 4 |
| `/admin` | platform_admin | 7 |

The buyer's **Track parcel** modal (Journey 5) reads `GET /api/parcels/:id` directly — buyers
have **no** logistics route access; the modal is the only delivery-visibility surface for them.

Any attempt to reach a route outside a role's access redirects away (see
`ProtectedRoute` + `UnknownRouteRedirect` in `src/App.jsx`).
