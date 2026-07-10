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

## Implementation decisions

Resolved during pre-implementation review. These bind the build; the sections
above state *what*, this states *where and how*.

### Membership shape

The backend continues to emit flat `[{business_id, business_name, role}]`
membership rows (one row per business-role pair; a `both` business yields two
rows sharing a `business_id`). No `/auth/me`, login, or register payload
contract changes.

The frontend groups these into `businesses`
(`[{business_id, business_name, roles: [...]}]`) in `AuthProvider`, memoized.
`roles` is sorted by a fixed rank so combined labels are stable:

```js
const ROLE_ORDER = { buyer: 0, wholesaler: 1, logistics_coordinator: 2, courier: 3 };
```

`AuthProvider` also derives `activeRoles` = the roles of the grouped active
business — the single source for every capability check.

### Backend authorization

- `getActiveMembership`'s multi-business `400` gate counts **distinct
  `business_id`**, not membership rows. A one-business user with several roles
  (e.g. `both`) resolves automatically; only genuinely ambiguous multi-business
  callers with no header get `400`. No new helper; the single-row return is
  kept because no caller reads `.role` off it (all three read `.business_id`).
- Parcel visibility (`parcelScope` in `routes/logistics.js`) resolves the
  active business and filters `memberships` to that business before
  classifying. A wholesaler business that is not the active selection grants no
  parcel-list rows. The multi-business `400` propagates from `parcelScope`
  through Express 5's async error forwarding to the central `errorHandler`; the
  list/detail handlers need no manual `catch`.
- The same `parcelScope` choke point serves both `/parcels` (list) and
  `/parcels/:id` (single-parcel tracking), so buyer-only single-parcel reads
  remain scoped to the active buyer business.

### Frontend capability and navigation

- `hasAnyRole` (and the underlying `hasAccess`) evaluate against `activeRoles`
  plus global platform-admin, never the full cross-business membership set.
  All navigation, route guards, footer, mobile nav, and per-page action gates
  already route through `hasAnyRole`, so this is a single-point change.
- The business switcher renders one option per grouped business, labelled with
  the combined role list, and is shown only when `businesses.length > 1`.
- On a business switch, the routed subtree is remounted via
  `key={activeBusinessId}` on the element wrapping `<Outlet>`. This clears all
  business-scoped local component state and re-fires every page's mount fetch
  against the new active-business header — no per-page cache audit. `api.js`
  already writes the new selection to `localStorage` synchronously before the
  state change that triggers the remount, so the refetch reads the new header.
- Login and register always redirect to the mapped default for the active
  context. A business switch redirects **only** when the current route is no
  longer authorized for the active roles; an authorized route is left in place.
  When marketplace and operational roles coexist, the marketplace target wins.
  Redirect map:
  - buyer / wholesaler / buyer + wholesaler: `/`
  - courier: `/courier`
  - logistics coordinator: `/logistics`
  - platform admin: `/admin`
- `OrdersPage` action gating is rewritten to test
  `activeBusinessId === order.<side>_business_id` combined with
  `activeRoles.includes(<role>)`. The prior fallback that scanned all
  memberships is removed — it leaked capabilities from unselected businesses.
- `getPrimaryMembership` in `roleAccess.js` is dead and is deleted.

### Tests

Backend (`node --test`), on the authorization boundary:

- A one-business `both` caller resolves without `400` and can create as their
  business.
- Active buyer + wholesaler business lists wholesaler parcels (non-empty).
- Active buyer-only context returns an empty parcel list.
- A multi-business caller with no `X-Active-Business` gets `400` on `/parcels`.

Frontend behavior (switcher, combined labels, cache-clear on switch, redirect
mapping) is verified by manual demo — no frontend test runner is configured.

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
