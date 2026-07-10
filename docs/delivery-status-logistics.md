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
  The quick-action buttons posted tracking logs without a `courier_id`, so the
  newest log had `courier_id = NULL` and the parcel vanished from the courier's
  list the moment they touched it.
- Courier parcel visibility used to treat every unassigned parcel as one global
  pickup pool. Branch membership now defines the pool boundary.
- Admin-created courier user accounts were never linked to a `couriers` row
  (`couriers.user_id` stayed NULL), so a courier login saw nothing at all.
- `platform_admin` could not update order status at all
  (`canWholesalerManage` explicitly returns false for admins).

## The workflow

```
Wholesaler:  pending -> accepted -> preparing -> shipped   (stops here)
                                                  |
                                                  v  parcel auto-created (order_id set)
Courier:     [branch pickup pool] -> Picked Up -> ... -> Out for Delivery
                                                               |        |
                                                               v        v
                                                          Delivered  Returned
                                                               |        |
                                                               v        v
Order:                                                    delivered  returned
                                                         (automatic) (automatic)
```

This mirrors the industry-standard split (Shopify/Amazon/OMS): the seller
controls fulfillment only up to carrier handoff; after handoff, status is
carrier-event-driven. The seller never marks an order delivered.

## Decisions

1. **Order/parcel link.** `parcels.order_id INT REFERENCES orders(order_id)
   ON DELETE SET NULL`, nullable (migration `009`). Nullable keeps standalone
   course-deliverable parcels (BookParcel flow) valid. This is a deliberate,
   documented crossing of the course-deliverable / marketplace boundary: the
   boundary was already crossed by `parcels.sender_id/receiver_id -> businesses`
   and by `orders.js` inserting parcels at `shipped`.
2. **Order status vocabulary.** `shipped` keeps its name (no `packaged`
   rename). Order statuses are: `pending, accepted, preparing, shipped,
   delivered, cancelled, returned`. `returned` is the terminal failed-delivery
   outcome; it is not a post-delivery buyer return or RMA state.
3. **Wholesaler control ends at `shipped`.** The `shipped -> delivered` and
   `shipped -> returned` transitions are unavailable to wholesalers; both
   outcomes are driven by parcel tracking. `platform_admin` keeps a manual
   transition override as a support/escape hatch for stuck or legacy orders,
   such as parcels created before `order_id` existed.
4. **Branch-scoped pickup pool.** `parcels` stay stateless: current handling
   branch and courier assignment are derived from the latest `tracking_logs`
   row. A branch on a tracking log means the dispatch/handling branch, not
   necessarily the parcel's physical scan location.
   Couriers see any parcel they have ever handled plus the unassigned pool for
   their assigned branch (`latest.courier_id IS NULL` and `latest.branch_id`
   matches `couriers.assigned_branch_id`, including NULL-to-NULL for branchless
   couriers). A courier claims a parcel with the "Picked Up" action.
   Coordinator manual assignment on the parcel detail page still works
   alongside.
5. **Branch stamping and unassign semantics.** New parcels start in the branch
   pool for the origin city: `origin_address.city_municipality` is matched
   case-insensitively against branch address city; no match leaves
   `branch_id = NULL` for manual coordinator assignment. New tracking logs
   carry forward the latest non-NULL `branch_id` when no branch is supplied.
   Existing null branch rows are backfilled by migration 012 from origin city
   or courier home branch. Coordinator/admin logs that omit `courier_id`
   deliberately unassign the parcel back to the effective branch pool;
   `courier_id` is not carried forward.
6. **Courier identity is server-side.** On `POST /api/parcels/:id/tracking`,
   a courier-role caller has `courier_id` and their assigned branch stamped
   from their own linked `couriers` row; client-supplied `courier_id` and
   `branch_id` are ignored for couriers (no spoofing). Coordinators/admins may
   pass explicit assignment fields. This also fixes the vanishing-parcel bug.
   The parcel detail timeline labels branch events as "handled by" the branch,
   omits branch wording for `Out for Delivery`, and shows `Delivered` against
   the destination address instead of saying the parcel was delivered at a hub.
   Courier-role status updates are forward-only: once a parcel reaches a later
   phase such as `Out for Delivery`, couriers cannot log an earlier phase such
   as `Picked Up`. Couriers may log normal delivery movement through
   `Delivered` or `Returned`, and those two outcomes end courier updates.
   `Cancelled` is not a courier field action; it remains temporarily available
   only to coordinators/admins as an operational correction.
7. **Terminal delivery outcomes map back to the order.** When an authorized
   tracking actor logs `Delivered` or `Returned` on a parcel with an `order_id`,
   a linked `shipped` order flips to `delivered` or `returned` in the same
   transaction. `Delivered` notifies the buyer. `Returned` notifies both the
   buyer and wholesaler with warning messages and includes the tracking remarks
   when present. Coordinator/admin-only parcel `Cancelled` remains an
   exceptional correction and does not map to an order status.
8. **Courier user provisioning.** Admin "create courier user" also inserts a
   linked `couriers` row (same transaction). Existing unlinked demo accounts
   get a one-off `UPDATE couriers SET user_id = ...` relink.
9. **Payment gate not enforced.** `payments.payment_status` remains ERD/report
   material; dispatch is not blocked on payment. Documented simplification.
10. **Delivered parcels stay visible** in the courier dashboard as history:
   nothing disappears from the list when acted on.

## Logistics API payload notes

- `GET /api/parcels` includes `latest_courier_id` so the courier dashboard can
  group available pool parcels, active assigned parcels, and completed history.
- `GET /api/parcels/:id` includes `latest_courier_id` and `latest_branch_id` so
  coordinator/admin tracking updates can pre-fill the current assignment.

## Out of scope (deferred)

- Post-delivery buyer returns (RMA) remain separate from failed delivery. An
  RMA requires a new reverse parcel plus refund semantics and is not represented
  by the failed-delivery `Returned -> returned` mapping built here.
- Full removal of parcel `Cancelled` after replacement correction/refund
  workflows exist.
- Third-party carrier integration - product-scope delivery model per
  `ROADMAP.md` is unchanged; this workflow serves the course-deliverable demo
  surface.
