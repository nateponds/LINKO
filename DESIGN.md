# LINKO Design System (`DESIGN.md`)

Single source of truth for visual tokens, elevation, layering, and canonical UI components in `src/`.

> **Legacy Reference Notice:** The top-level `designs/` directory is **legacy reference only**. Never copy markup, inline styles, or CSS rules from `designs/` into `src/`.

## 1. Core Tokens (`src/assets/css/index.css`)

| Token | Value | Usage |
| :--- | :--- | :--- |
| `--color-primary` | `#315bc5` | Primary brand actions, links, active accents |
| `--color-primary-dark` | `#203c78` | Primary hover states, deep headings |
| `--color-primary-soft` | `#edf2fc` | Soft primary tint, active pills, subtle highlights |
| `--color-accent` | `#98d868` | Focus rings (`outline: 3px solid var(--color-accent)`), highlight accents |
| `--color-accent-dark` | `#5b9f35` | Accessible green text/icons on light surfaces |
| `--color-surface` | `#e5e9ef` | Page canvas background, subtle dividers |
| `--color-card` | `#f5f7fa` | Elevated card/panel surfaces |
| `--color-text` | `#1d2c43` | Default body and heading text |
| `--color-muted` | `#637087` | Secondary labels, captions, helper text |
| `--dm-sans` | `"DM Sans", sans-serif` | Base UI typeface |
| `--layout-max-width` | `1360px` | Max content container width |
| `--layout-gutter` | `clamp(16px, 3vw, 40px)` | Responsive horizontal page gutter |
| `--mobile-nav-height` | `calc(64px + env(safe-area-inset-bottom))` | Bottom mobile nav clearance (`shell.css`) |

### Discovery Category Accents (`SupplierDiscoveryPage.css`)

- `--color-sunset: #f2843c` (`--color-sunset-dark: #c96420`)
- `--color-plum: #7c5cbf` (`--color-plum-dark: #5a3f96`)

## 2. Promoted Semantic Tokens, Radii, Shadows & Z-Index

Use these semantic tokens across all new and refactored stylesheets instead of hardcoding hex values or arbitrary numbers:

### Semantic Surfaces & Status
- **Neutrals:** `--color-surface-white` (`#ffffff`), `--color-border` (`#d5dce6`), `--color-hairline` (`#e6ebf2`)
- **Danger:** `--color-danger` (`#c53030`), `--color-danger-soft` (`#fdecec`)
- **Warning:** `--color-warning` (`#b45309`), `--color-warning-soft` (`#fef5e7`)
- **Success:** `--color-success` (`#1f7a3f`), `--color-success-soft` (`#eaf7ee`)

### Radius Scale
- `6px` — inputs, compact tags, small controls
- `8px` — buttons, dropdown items, alert banners
- `12px` — cards, tables, panels
- `14px` — modals, drawers, elevated overlays
- `999px` — pills, badges, circular icon buttons

### Shadows
- `--shadow-sm` — subtle card resting elevation
- `--shadow-md` — interactive cards, popovers, dropdowns
- `--shadow-modal` — modal dialogs and floating panels

### Z-Index Ladder

| Layer | Z-Index | Usage |
| :--- | :--- | :--- |
| Local / Sticky | `10–100` | Sticky table headers, map controls, inline overlays |
| Sub-navigation | `900` | Secondary bars, collapsible drawers |
| App Chrome | `1000–1200` | Topbar, mobile bottom navigation |
| Modals | `2000–2500` | Standard modal dialogs (`Modal`, `ProductDetailModal`, `SupportModal`) |
| Confirm Overlays | `2600` | `ConfirmDialog` stacked above active modals |
| Notifications | `3000` | `Toast` and critical global alerts |

## 3. Canonical Component Inventory

Reuse these components instead of creating duplicate primitives:

| Component | Location | Responsibility |
| :--- | :--- | :--- |
| `Button` | `src/components/ui/Button.jsx` | Standard button variants (`primary`, `secondary`, `ghost`, `danger`) and sizes |
| `Modal` | `src/components/ui/Modal.jsx` | Accessible dialog shell wired with `useDialogFocus` |
| `AlertBanner` | `src/components/ui/AlertBanner.jsx` | Inline status feedback (`info`, `success`, `warning`, `danger`) |
| `Badge` | `src/components/ui/Badge.jsx` | Status pills and compact metadata labels |
| `ConfirmDialog` | `src/components/ui/ConfirmDialog.jsx` | Destructive or high-impact confirmation dialog |
| `PaginationControls` | `src/components/ui/PaginationControls.jsx` | Shared paginated list footer controls |
| `SearchField` | `src/components/ui/SearchField.jsx` | Standardized search input with icon and clear affordance |
| `ExpandableTableRow` | `src/components/ui/ExpandableTableRow.jsx` | Accessible collapsible detail rows for operational tables |
| `Skeleton` / `pageSkeletons` | `src/components/ui/Skeleton.jsx`, `pageSkeletons.jsx` | Loading placeholders respecting reduced-motion preferences |
| `Toast` | `src/components/ui/Toast.jsx` | Transient global notifications |
| `DecisionStrip` | `src/components/DecisionStrip.jsx` | Compact inline action/decision bar |
| `MapPicker` / `ParcelRouteMap` | `src/components/ui/MapPicker.jsx` | Mapbox location picker and multi-stop parcel route map |
| `ProductCard` / `MarketplaceProductCard` | `src/features/products/ProductCard.jsx`, `MarketplaceProductCard.jsx` | Seller product management card and buyer marketplace card |
| `ProductDetailModal` | `src/components/ui/ProductDetailModal.jsx` | Full product inspection modal |
| `TrackingTimeline` | `src/features/logistics/TrackingTimeline.jsx` | Chronological parcel scan and status timeline |
| `SupportModal` | `src/components/ui/SupportModal.jsx` | Help and support contact modal |
| `AuthVisualPanel` | `src/components/ui/AuthVisualPanel.jsx` | Shared visual side panel for auth screens |
| `useDialogFocus` | `src/components/ui/useDialogFocus.js` | Focus trap, Escape handling, and focus restoration for dialogs |

## 4. Styling & Icon Rules

- **Icons:** Use `lucide-react` exclusively (`svg.lucide { flex-shrink: 0; }` is enforced globally). Do not hand-write inline `<svg>` icons or add other icon libraries.
- **No static inline `style={{}}`:** Author all static layout, color, spacing, and typography rules in external `.css` files using tokens above. Reserve inline `style` strictly for truly dynamic runtime values (e.g., computed coordinates or progress widths).
- **Accessibility:** Preserve `:focus-visible` outlines (`var(--color-accent)`), semantic buttons/links, and `useDialogFocus` on all custom dialogs.
