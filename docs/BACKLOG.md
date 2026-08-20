# Backlog

## Authenticated "Add a Business" Flow

Status: Proposed
Suggested by: @nateponds
Date added: 2026-07-13
Area: Frontend / Backend
Priority: Low
Related docs: `SPRINTS.md` (Sprint 9)

Description:
There is no UI path for an already-logged-in user to register a second business (of either role) onto their account. `RegisterPage.jsx` redirects any logged-in user away, so the only way a user ends up with two businesses (like the `bizswitch@linko.test` demo account) is a seed-SQL insert, never a real signup path. Consider an authenticated "add a business" flow — its own route/modal that hits a register-style endpoint without dropping the current session.

Reason:
Sprint 9 replaced the single-both-role business with a two-business model (one buyer business + one wholesaler business, switched via the Topbar switcher) as the supported way to need both capabilities. That model currently only works for seeded data; a real user cannot self-serve into it.

Expected outcome:
A logged-in user can add a second business (opposite or same role) to their account and immediately see it in the business switcher, without logging out or losing session state.
