# LINKO Sprint Plan

This file is the active forward-looking delivery plan. Completed historical  
milestones live in git history and release notes; this file should only describe  
work that still needs product, design, implementation, or release attention.

---

### Completed Sprints

**Sprint 7: Logistics Correctness & Authz** (Done)  
Closed correctness and authorization holes in the logistics tracking system, including replacing timestamp IDs with safe sequences, enforcing courier read/write scope rules, introducing row-level database locks for claims, and fully implementing soft-delete semantics for reference data.

**Sprint 8: Logistics Workflow Integrity & Buyer Visibility** (Done)  
Ensured end-to-end honesty in the demo workflow by recording actual parcel weights at shipment, progressing payment statuses based on method, enforcing proof-of-delivery remarks, and adding a read-only tracking modal for buyers. The dead standalone booking UI was removed.

**Sprint 9: Phase Out the Both-Role Combination** (Done)  
Eliminated the overlapping "both" role (buyer + wholesaler) to ensure strict separation. Added unique role-per-business constraints, updated the registration flow, and adapted seed data to showcase the top-bar multi-business switching feature instead. (Supersedes the Sprint 8 Follow-up).

**Sprint 11: Parcel Cancellation Workflow** (Done)  
Implemented a backend-enforced admin/coordinator `Cancelled` tracking operation that correctly cascades to cancel the underlying marketplace order and fail pending COD payments, complete with necessary notifications.

**Sprint 12: Editable Service Tier Pricing (PUT-only)** (Done)  
Provided platform admins with a secure UI and endpoint to edit service tier rates, ensuring via database triggers that historical parcels retain their frozen original shipping fee.

---

## Execution Rules

- Keep future sprints small, reviewable, and tied to the active product model.
- Prefer backend-enforced workflow rules over frontend-only hiding.
- Do not reintroduce guest app access.
- Do not allow public registration for logistics, courier, or platform admin.
- Do not build buyer-facing standalone parcel booking.
- Buyers get read-only delivery visibility scoped to their own orders (Sprint 8  
  modal); never logistics workspace access or a similar account surface to  
  courier/coordinator dashboards.
- Keep buyer-wholesaler marketplace framing as the primary LINKO workflow.
- Treat logistics as fulfillment after an order exists.
- Treat buyer cancellation as pre-shipment order behavior.
- Treat post-shipment buyer issues as returns/refunds, not cancellation.
- Add tests when changing auth, ownership, orders, invoices, products,  
  logistics, tracking status rules, or money movement.
