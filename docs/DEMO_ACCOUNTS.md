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
| `both@linko.test` | Bo Bothway | Metro Cebu Trading | `buyer` **and** `wholesaler` | One user, two memberships — exercises the **business switcher** |
| `courier2@linko.test` | Carlo Courier | Carlo Quick Haul | `courier` | Second courier assigned to the Mandaue hub |

## What the seed loads

Beyond the accounts, `dev_seed.sql` provisions a coherent demo dataset so every page has
content on first login:

- **9 businesses** (one per user) spanning buyer, wholesaler, both, logistics, and courier types.
- **13 wholesale products** across two wholesalers plus the "both" business.
- **2 warehouses**, **2 branches** (Cebu + Mandaue hubs), and **2 couriers**.
- **4 orders** spread across statuses (`pending`, `accepted`, `shipped`, `delivered`)
  with order items, **3 invoices**, **2 parcels**, and a realistic **tracking-log** history.

## Admin-created accounts (logistics / courier)

Logistics-coordinator, courier, and additional platform-admin accounts are **privileged**
and are **not** self-registerable. They are created two ways:

1. **Seeded** — the accounts in the tables above.
2. **Via the Admin dashboard** — log in as `admin@linko.test`, open **Admin** (`/admin`),
   and use **Create user** with a `kind` of `logistics_coordinator`, `courier`, or
   `platform_admin`. Coordinator and courier kinds require a business to attach the
   membership to; admin kind sets the global role. Newly created accounts can log in
   immediately with the password you set for them.

Public self-registration (`/register`) only creates buyer/wholesaler marketplace accounts.

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
