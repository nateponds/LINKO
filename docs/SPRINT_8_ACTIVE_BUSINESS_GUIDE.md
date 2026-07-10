# Sprint 8 Follow-up: Active Business Guide

**Status:** Planned
**Parent:** [Sprint 8 follow-up](./SPRINTS.md#sprint-8-follow-up-mixed-role-active-business-context)

## Purpose

This follow-up fixes the mixed-role/active-business model without changing the
completed Sprint 8 scope. `X-Active-Business` selects the business the caller is
acting for. It does not select or suppress a role.

## Context model

- Group memberships by unique `business_id`.
- One business is one switcher option, even when the user has several roles in
  that business.
- Roles inside the selected business are additive. Display combined role labels
  in this stable order: **Buyer, Wholesaler, Logistics Coordinator, Courier**.
- Memberships and capabilities from every other business are inactive until
  that business is selected.
- Show the business switcher only when the user belongs to more than one unique
  business.
- With one unique business, select it automatically.
- With several businesses, restore the last-used business when it is still a
  valid membership; otherwise select the first business in the available list.

## API rules

- Send the selected business id in `X-Active-Business` for business-scoped API
  requests.
- When a non-admin caller has more than one unique business and does not provide
  a selection, reject both reads and writes with `400`. Do not infer a business
  from the requested role or choose the first membership on the server.
- When the caller has one unique business, the API may resolve it automatically.
- Validate every explicit selection against the caller's current memberships.
- Within the selected business, authorize an operation against the complete set
  of roles for that business.
- A platform admin remains global for administrative operations. Explicit buyer
  or wholesaler actions still require a valid active business with the required
  business role.

## Capability rules

- A business with both buyer and wholesaler roles receives both sets of API
  capabilities.
- This includes wholesaler parcel-list visibility; adding buyer capability must
  not reduce the wholesaler list scope.
- A buyer-only business receives an empty parcel list and may access only the
  existing buyer-scoped single-parcel tracking flow.

## Frontend behavior

- Build navigation, route access, and actions from the additive roles of the
  selected business plus any global platform-admin capability.
- On a business switch, clear business-scoped cached/stateful data before
  refetching for the new selection. Refresh all affected views so stale rows,
  counts, details, and permissions cannot carry across businesses.
- If the current route is invalid after login or a business switch, redirect by
  the selected context:
  - buyer: marketplace home (`/`)
  - wholesaler or buyer + wholesaler: marketplace home (`/`)
  - courier: courier dashboard (`/courier`)
  - logistics coordinator: logistics workspace (`/logistics`)
  - platform admin: admin dashboard (`/admin`)

## Demo and documentation correction

Update `docs/DEMO_SCRIPT.md` during implementation. It currently treats the
buyer and wholesaler memberships of `both@linko.test` as separate switchable
roles. The corrected demonstration must show one option per unique business and
both roles active together when they belong to the same selected business.

## Verification checklist

- [ ] Duplicate-role memberships for one business produce one switcher option.
- [ ] Combined labels always use the documented role order.
- [ ] The switcher is absent for one unique business and present for two or more.
- [ ] Last-used selection restores only while membership remains valid.
- [ ] Missing selection for a multi-business user returns `400` on reads and
      writes.
- [ ] Roles from an unselected business grant no navigation or API capability.
- [ ] Buyer + wholesaler context can perform both workflows and list wholesaler
      parcels.
- [ ] Buyer-only parcel list is empty.
- [ ] Switching clears stale data, refreshes the page context, and redirects an
      invalid route according to the documented mapping.
- [ ] Platform-admin global actions work without weakening business selection
      for explicit buyer/wholesaler actions.
- [ ] The demo script no longer describes role selection as business selection.
