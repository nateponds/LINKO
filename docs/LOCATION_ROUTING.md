# Location Routing & Map Integration — Design Decisions (Sprint 13)

**Status:** finalized 2026-07-18; contracts landed, implementation pending.
This document records the approved design. Implementation must follow it; do not
reopen these decisions without a material contradiction that makes them unsafe
or impossible.

## Objective

Add geolocation to LINKO's point-to-point parcel logistics: coordinates on
addresses, a canonical logistics location per business, nearest-available-branch
automatic assignment, server-authoritative pricing distance, immutable
planned-route snapshots, Settings and branch-management pinning surfaces, and a
shared Mapbox map picker. Graded CIS 2104 scope (Branches core table; UC9 branch
management; courier/logistics refinement confirmed graded 2026-07-17).

## Pre-launch data policy

LINKO is not production-launched. All database contents are disposable
development fixtures. Schema work edits migration `023_location_routing.sql`
**in place** (it never reached `main` or the production database); developers
drop and re-migrate local databases once. No runtime backfills, no
correction-chain migrations, no compatibility behavior for seeded history.
Seeds carry the demo data (branch coordinates with unambiguous nearest-branch
geometry, business location pointers, pinned canonical addresses).

## Data model (final migration 023 content)

1. **`addresses.latitude` / `addresses.longitude`** — `NUMERIC(10,7)`, with
   CHECK constraints: both NULL or both present; latitude ∈ [-90, 90];
   longitude ∈ [-180, 180]; exact (0,0) rejected ("Null Island").
   `pg` returns `NUMERIC` as strings, so every API SELECT casts coordinates to
   `float8` — coordinates are always JSON **numbers** (or `null`) on the wire,
   always named `latitude`/`longitude`. Positional `[lng, lat]` arrays exist
   only inside the frontend `MapPicker` component.
2. **`branches.is_available`** — `BOOLEAN NOT NULL DEFAULT true`. Temporary
   gate on **new automatic assignment only**. Distinct from `is_active`
   (permanent soft retirement; existing DELETE semantics and tests unchanged).
   Toggling availability never unassigns couriers and never blocks parcel
   movement. Coordinators may still manually assign to an active-but-unavailable
   branch (the tracking route keeps validating `is_active` only).
3. **`businesses.logistics_address_id`** — nullable FK → `addresses`,
   `ON DELETE SET NULL`. The canonical pin: buyer delivery location /
   wholesaler pickup location. Registration sets the pointer to the placeholder
   address it creates; the Settings PUT repairs/creates it. Replaces the
   nondeterministic `LIMIT 1` wholesaler-address pick at marketplace ship time.
4. **`parcel_route_stops`** — immutable planned-route snapshot, PK
   `(parcel_id, stop_order)`, `stop_type` ∈ `origin | branch | destination`,
   nullable `branch_id` (branch stop only), nullable informational
   `source_address_id`, snapshot copies of label, address text fields, and
   coordinates. Created once (auto-assignment, or first later manual
   assignment); never recomputed. Re-pinning a business or branch never changes
   existing snapshots. The PK makes retries idempotent.

## Branch lifecycle matrix

| Branch state | New auto-assignment | Manual assignment | Existing movement | Management list |
|---|---|---|---|---|
| active + available | yes | yes | yes | visible |
| active + unavailable | no | yes | yes | visible |
| inactive (retired) | no | no | history/drain only | hidden |

No status-transition rule may ever check `is_available` — a disabled branch
must drain its in-flight parcels through the full status path.

## Branch assignment (shared resolver)

One shared resolver replaces both duplicated `findBranchIdByCity` copies
(standalone booking and marketplace ship). Resolution chain:

1. Origin address coordinates present → Haversine nearest branch among
   `is_active AND is_available AND` complete coordinates;
   `ORDER BY distance ASC, branch_id ASC`; acos argument clamped with
   `LEAST(1.0, GREATEST(-1.0, …))` (identical points otherwise NaN).
2. Otherwise → city fallback: `LOWER(TRIM(city_municipality))` match among
   active + available branches, `ORDER BY branch_id`.
3. Otherwise NULL — the parcel is still created, is invisible to courier
   pickup pools, and awaits manual coordinator assignment. Assignment miss
   never fails parcel creation. The city fallback is permanent — never deleted.

Plain-SQL Haversine only: no PostGIS/earthdistance (tens of branch rows), no
Dijkstra/transfer graph, no Directions API in v1. Nearest-across-water and
antimeridian wraparound are accepted limitations (PH-only deployment).

## Pricing distance

`parcels.total_distance_km` is **server-computed**: direct origin → destination
Haversine, one formula for both creation paths. Branch choice never affects
price. The client-supplied `total_distance_km` field is removed from both
creation contracts (ignored if sent). Stored shipping fees stay frozen after
later re-pins or tier edits (existing trigger behavior).

## Missing-coordinate policy: block until pinned

Each actor is blocked at their own earliest touchpoint, by their own missing
pin, with a `409` and a frontend link to Settings:

- **Buyer** — cannot place a marketplace order until their business is pinned.
- **Wholesaler** — cannot mark an order `shipped` until their business is
  pinned.
- **Standalone booking** — rejected unless both the origin and destination
  addresses have coordinates.

Marketplace ship also hard-rolls-back (no silent skip) if either canonical
address is missing at ship time. Because gates guarantee endpoint coordinates,
new parcels always get a real distance; the fee trigger's NULL-distance branch
is defensive only. Unpinning (saving a null coordinate pair) is allowed — the
gates simply re-engage.

## Planned route vs actual tracking

The planned route (origin → assigned branch → destination) is **display-only
reference data**. Actual tracking diverges freely: hub transfers, reassignment,
and the return leg all remain exactly as tested today. Never insert
future/expected checkpoints into `tracking_logs` (the latest row defines
current status). No `parcels.branch_id` column; no assignment-only endpoint —
manual assignment stays coupled to the tracking-write transaction.

## Session and UI surface

- Each membership object in `/api/auth/me`, login, and register responses
  carries `has_coordinates` (true ⇔ the canonical logistics address has both
  coordinates). Frontend `groupMemberships` preserves `business_type` and
  `has_coordinates` per business.
- A shared `AppLayout` banner shows when the active business is a
  buyer/wholesaler with `has_coordinates` false; it links to Settings and
  clears via `refreshAuth()` after save. Logistics-only roles never see it.
- Settings edits the full normalized address plus the coordinate pair
  (create-or-update; the only surface that repairs registration placeholder
  addresses). Role-aware copy: buyer = delivery location, wholesaler = pickup.
- Branch management: availability toggle is the primary affordance
  ("stops new automatic assignments only"); retirement (DELETE) is demoted
  behind an explicit confirmation. `/logistics/management` is restricted to
  `logistics_coordinator | platform_admin`.
- Geocoder is pin-assist only: it moves the map/pin and shows a hint label but
  never writes normalized address text fields. Manual click-to-place is ground
  truth. Missing token or map-load failure falls back to numeric inputs —
  Settings and branch management stay fully usable without Mapbox.
- Read-only parcel map renders planned-stop markers plus dashed straight
  segments captioned "approximate route — not road directions". Stops with
  NULL coordinates keep their text row but are omitted from markers. An empty
  `planned_route` renders an explanatory empty state.
- `VITE_MAPBOX_TOKEN` is a client-exposed publishable token: never committed,
  domain-restricted in the Mapbox dashboard before production.

## Explicit non-goals

No PostGIS; no Dijkstra/route graph; no Directions API (v1); no
`parcels.branch_id`; no assignment-only endpoint; no availability checks in the
tracking/status layer; no planned-route enforcement; no runtime backfills; no
future checkpoints in `tracking_logs`; no multi-address pin UI; no geocoder
auto-fill of address text; no marker drag / reverse geocode / standalone
address CRUD (deferred).
