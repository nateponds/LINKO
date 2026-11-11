# Backlog

## Local staging review: addresses, role access, and confidentiality

Status: In progress
Suggested by: @nateponds
Date added: 2026-11-10
Area: Frontend / Backend / Security
Priority: High

Description:
- A new business with no actual addresses shows a placeholder Primary address filled with "Not provided". Show an empty address state until an address is supplied.
- Hide marketplace and e-commerce pages and navigation from admins, logistics coordinators, couriers, and other roles without marketplace duties. Buyers and wholesalers retain access appropriate to their roles; avoid links that immediately redirect a user away.
- Protect invoice, inventory, order, and parcel contents in both API responses and UI. Admins, logistics coordinators, and couriers must not see package contents; only the sender and receiver may see full contents, scoped to their own transactions. Preserve operational information needed for delivery.
- Review the fourth screenshot of the admin Logistics Management page; the specific criticism was not supplied and needs clarification before assuming a change.

Expected outcome:
An empty address book stays empty, navigation reflects role access, and server-side authorization prevents users from accessing confidential transaction details outside their permitted scope. Verify with role and ownership tests, including direct API requests.

## Authenticated "Add a Business" Flow

Status: Implemented
Suggested by: @nateponds
Date added: 2026-07-13
Area: Frontend / Backend
Priority: Low
Related docs: `SPRINTS.md` (Sprint 9)

Description:
Signed-in buyers and wholesalers can add businesses at `/businesses/new` from the Topbar account area. Each business has one type; accounts can own any number of either type, without logging out.

Reason:
Sprint 9 replaced the single-both-role business with a two-business model (one buyer business + one wholesaler business, switched via the Topbar switcher) as the supported way to need both capabilities. Users can now self-serve additional businesses through `POST /api/businesses` and switch between them with the existing Topbar switcher.

Expected outcome:
A logged-in user can add a second business (opposite or same role) to their account and immediately see it in the business switcher, without logging out or losing session state.
