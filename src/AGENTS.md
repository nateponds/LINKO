# Frontend Agent Guide (`src/`)

Scoped rules for React 19 + Vite 8 JSX code in `src/`. Also follow root `AGENTS.md`, `DESIGN.md`, and `CODING_STANDARDS.md`.

## Module Boundaries

- **No sibling deep imports across `src/features/*`:** A feature in `src/features/<domainA>/` must not reach into internals of `src/features/<domainB>/`. Share cross-domain code through `src/components/ui/`, `src/lib/`, or `src/hooks/`.
- **No `components/navigation/` -> `features/` imports:** Navigation chrome (`Topbar`, `SubNav`, `MobileNav`, `Footer`) stays feature-agnostic.
- **Keep `src/components/ui/` generic:** Push domain models and API calls into `src/features/` or `src/pages/`.

## Auth & Role Checks

- Centralize all route and action gating in `src/auth/roleAccess.js` (`ROUTE_ACCESS`, `ACTION_ACCESS`, `hasAnyRole`).
- Never scatter raw role string comparisons (`user.role === ...`) across pages or components.

## API Client & Errors

- All backend requests go through `src/lib/api.js` (never raw `fetch()`).
- Thrown API errors expose `error.status` (HTTP status code), **not** `statusCode`. Handle `error.status` consistently for `401`/`403`/`404`/validation branches.

## Design System & Styling

- Reuse `DESIGN.md` tokens and canonical primitives (`Button`, `Modal`, `AlertBanner`, `Badge`, `ConfirmDialog`, `SearchField`, `PaginationControls`, `Toast`, `Skeleton`) before inventing new markup.
- Use `lucide-react` icons only; no inline SVGs or other icon libraries.
- Ban static inline `style={{}}` — put layout and visual rules in external CSS files using `--color-*` and semantic tokens.
- Never copy legacy HTML/CSS from `designs/`.
