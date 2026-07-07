# Delivery Status & Courier Logistics Workflow

Decisions settled 2026-07-07 (grilling session) for making the courier account
workflow functional. This document is the source of truth for how order status
and parcel tracking interact. It supersedes the wholesaler-drives-everything
flow that shipped with Milestone 3.

## Problem this fixes

- `parcels` had no link back to `orders`: once a wholesaler marked an order
  `shipped` and the parcel was auto-created, the system lost the connection.
  Couriers could update parcel tracking, but the order stayed `shipped`
  forever unless the wholesaler manually flipped it to `delivered`.
- Courier dashboard scoped parcels by "latest tracking log's `courier_id`".
  The quick-action buttons posted tracking logs **without** a `courier_id`,
  so the newest log had `courier_id = NULL` and the parcel vanished from the
  courier's list the moment they touched it.
- Admin-created courier user accounts were never linked to a `couriers` row
  (`couriers.user_id` stayed NULL), so a courier login saw nothing at all.
- `platform_admin` could not update order status at all
  (`canWholesalerManage` explicitly returns false for admins).

## The workflow

```
Wholesaler:  pending -> accepted -> preparing -> shipped   (stops here)
                                                  |
                                                  v  parcel auto-created (order_id set)
Courier:     [pickup pool] -> Picked Up -> ... -> Out for Delivery -> Delivered
                                                                        |
                                                                        v
Order:                                                              delivered (automatic)
```

This mirrors the industry-standard split (Shopify/Amazon/OMS): the seller
controls fulfillment only up to carrier handoff; after handoff, status is
carrier-event-driven. The seller never marks an order delivered.

## Decisions

1. **Order/parcel link.** `parcels.order_id INT REFERENCES orders(order_id)
   ON DELETE SET NULL`, nullable (migration `009`). Nullable keeps standalone
   course-deliverable parcels (BookParcel flow) valid. This is a deliberate,
   documented crossing of the course-deliverable / marketplace boundary —
   the boundary was already crossed by `parcels.sender_id/receiver_id -> businesses`
   and by `orders.js` inserting parcels at `shipped`.
2. **Status vocabulary unchanged.** `shipped` keeps its name (no `packaged`
   rename). Order statuses stay: `pending, accepted, preparing, shipped,
   delivered, cancelled`.
3. **Wholesaler control ends at `shipped`.** The `shipped -> delivered`
   transition is removed from wholesalers; the "Mark Delivered" wholesaler UI
   is removed. `platform_admin` gains a transition override (support/escape
   hatch for stuck or legacy orders, e.g. parcels created before `order_id`
   existed).
4. **Pickup pool.** Couriers see parcels assigned to them **plus** unassigned
   parcels (latest tracking log has `courier_id IS NULL`). A courier claims a
   parcel with the "Picked Up" action. Coordinator manual assignment on the
   parcel detail page still works alongside.
5. **Courier identity is server-side.** On `POST /api/parcels/:id/tracking`,
   a courier-role caller has `courier_id` stamped from their own linked
   `couriers` row — a client-supplied `courier_id` is ignored for couriers
   (no spoofing). Coordinators/admins may pass an explicit `courier_id`.
   This also fixes the vanishing-parcel bug.
6. **Only `Delivered` maps back to the order.** When a courier logs
   `Delivered` on a parcel with an `order_id`, the order flips to
   `delivered` and the buyer gets an "Order Delivered" notification.
   `Returned` / `Cancelled` stay parcel-side (no order mapping) — deferred.
7. **Courier user provisioning.** Admin "create courier user" also inserts a
   linked `couriers` row (same transaction). Existing unlinked demo accounts
   get a one-off `UPDATE couriers SET user_id = ...` relink.
8. **Payment gate not enforced.** `payments.payment_status` remains
   ERD/report material; dispatch is not blocked on payment. Documented
   simplification.
9. **Delivered parcels stay visible** in the courier dashboard as history —
   nothing disappears from the list when acted on.

## Out of scope (deferred)

- `Returned`/`Cancelled` tracking -> order status mapping (restock/refund
  semantics not built).
- Branch-scoped pickup pools (all couriers see the whole pool).
- Third-party carrier integration — product-scope delivery model per
  `ROADMAP.md` is unchanged; this workflow serves the course-deliverable
  demo surface.
