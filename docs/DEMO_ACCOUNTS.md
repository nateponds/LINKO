# LINKO Demo Accounts

Pre-seeded accounts for evaluating LINKO. All accounts share the same password.

> **Password (every account):** `Password123!`

These accounts are created by the development seed (`backend/seeds/dev_seed.sql`) and
are safe to log in with on **local** and **staging** environments. They are **not** loaded
into production (see [Resetting the demo data](#resetting-the-demo-data)).

## Core role accounts

Use these four to walk through the graded journeys in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).
A fifth (platform admin) is included for administrative management.

| Email | Name | Business | Membership role | What they demo |
| --- | --- | --- | --- | --- |
| `buyer@linko.test` | Bianca Buyer | Sunrise Retail Cooperative | `buyer` | Discover wholesalers, place an order, view the invoice |
| `wholesaler@linko.test` | Waldo Wholesaler | Cebu Fresh Wholesale | `wholesaler` | Manage products/inventory, accept an order, create a shipment |
| `logistics@linko.test` | Lia Logistics | LINKO Logistics Hub | `logistics_coordinator` | Manage branches/couriers, assign a courier to a parcel |
| `courier@linko.test` | Cory Courier | Cory Express Delivery | `courier` | Update parcel tracking statuses through to delivered |
| `admin@linko.test` | Pia Platform Admin | LINKO Platform | *(none — global admin)* | Admin dashboard: user + business management |

> The platform admin has **no** `business_membership` row. Its authority comes from
> `users.global_role = 'platform_admin'`, which grants read-everything access and the
> `/admin` dashboard while deliberately **not** letting it act as a buyer or wholesaler
> in membership-gated write paths.

## Additional accounts

The seed also creates extra accounts to exercise multi-membership and multi-business
scenarios (e.g. the business switcher and cross-business ownership scoping).

| Email | Name | Business | Membership role(s) | Notes |
| --- | --- | --- | --- | --- |
| `buyer2@linko.test` | Ben Buyer Jr | Davao Sari-Sari Mart | `buyer` | Second buyer for ownership-isolation checks |
| `wholesaler2@linko.test` | Wendy Wholesaler | Mandaue Agri Supply | `wholesaler` | Second wholesaler with its own products/inventory |
| `bizswitch@linko.test` | Bo Bizswitch | Metro Cebu Trading — Retail **and** Metro Cebu Trading — Wholesale | `buyer` (business 8) + `wholesaler` (business 10) | One user with **two businesses** — exercises the business switcher. Sprint 9 replaced the prior single-"both"-business account with this two-business split so a single business can never be both buyer and wholesaler at once. |
| `courier2@linko.test` | Carlo Courier | Carlo Quick Haul | `courier` | Second courier assigned to the Mandaue hub |
| `courier3@linko.test` | Dexter Alcantara | LINKO Logistics | `courier` | Cebu Central hub — motorcycle, first-mile pickups |
| `courier4@linko.test` | Elmer Bacus | LINKO Logistics | `courier` | Mandaue hub — tricycle, first-mile pickups |
| `courier5@linko.test` | Grace Montano | LINKO Logistics | `courier` | Talisay hub — van (no seeded scan history) |
| `courier6@linko.test` | Jomar Ceniza | LINKO Logistics | `courier` | Lapu-Lapu hub — motorcycle (no seeded scan history) |
| `courier7@linko.test` | Rhea Sarmiento | LINKO Logistics | `courier` | Consolacion hub — L300 van (no seeded scan history) |
| `courier8@linko.test` | Vicente Duran | LINKO Logistics | `courier` | **Inactive** (`is_active = FALSE`) — exercises the deactivated-courier path |

## What the seed loads

Beyond the accounts, `dev_seed.sql` provisions a coherent demo dataset so every page has
content on first login:

- **28 businesses** (one per user, except `bizswitch@linko.test` who owns two — one buyer, one wholesaler) spanning buyer, wholesaler, logistics, and courier types. Sprint 9 dropped the `both` business type; a single business can no longer be both buyer and wholesaler.
- **28 wholesale products** across eight wholesalers, every one with a product image.
- **8 warehouses**, **5 branches** (Cebu Central, Mandaue, Talisay, Lapu-Lapu, Consolacion —
  all pinned and available, so nearest-hub routing has real choices), and **8 couriers**
  spread across those hubs (courier 8 is inactive).
- **32 orders** spread across statuses (`pending`, `accepted`, `shipped`, `delivered`,
  `returned`) with order items, **31 invoices**, **30 parcels**, and a realistic
  **tracking-log** history (220 scans) — including clean delivery journeys (COD collected on
  delivery) and failed-delivery journeys (COD failed on return).
- **First-mile / last-mile courier handoffs**: a pickup rider collects at the origin hub and a
  different driver runs the last mile from the destination hub, so 17 parcels show two or more
  couriers in their history, and some drivers batch several deliveries onto one day.

## Admin-created accounts (logistics / courier)

Logistics-coordinator, courier, and additional platform-admin accounts are **privileged**
and are **not** self-registerable. They are created two ways:

1. **Seeded** — the accounts in the tables above.
2. **Via the Admin dashboard** — log in as `admin@linko.test`, open **Admin** (`/admin`),
   and use **Create user** with a `kind` of `logistics_coordinator`, `courier`, or
   `platform_admin`. Coordinator and courier kinds require a business to attach the
   membership to; admin kind sets the global role. Newly created accounts can log in
   immediately with the password you set for them.

Public self-registration (`/register`) only creates buyer or wholesaler marketplace accounts. Sprint 9 removed the `both` option: a single business can no longer be both buyer and wholesaler. A user who needs both capabilities registers two separate businesses and switches between them via the top-bar business switcher.

## Resetting the demo data

The seed is **destructive and idempotent** — it wipes marketplace + logistics data and
re-applies the fixed dataset above, so you can always return to a known-good state.

From `backend/`, with `DATABASE_URL` pointing at the target database:

```bash
npm run seed:demo
```

Notes:

- The script **refuses to run when `NODE_ENV=production`** unless you pass `--force`.
  Production is intentionally kept free of demo data.
- Because the reset restores fixed IDs and content, re-running it after a demo returns
  every account, order, and parcel to its original state.
- After reset, log in with any account above using `Password123!`.
