# Backlog

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
