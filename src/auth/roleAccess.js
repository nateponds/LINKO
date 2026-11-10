// RBAC policy (mirrored server-side in backend/src/middleware/auth.js):
//   - Business roles (buyer, wholesaler, logistics_coordinator, courier) count
//     only for the ACTIVE business. Roles on an unselected business grant nothing.
//   - platform_admin is global and passes a check ONLY when the list names it.
//     There is no implicit admin bypass; admin reach is decided per route here.
//   - An empty list means "any signed-in user".
const MARKETPLACE = ["buyer", "wholesaler", "platform_admin"];
const PARCEL_READERS = ["wholesaler", "logistics_coordinator", "courier", "platform_admin"];

// The one route table. App.jsx guards each path with its own entry and every
// nav surface looks links up here, so a guard and its nav link cannot drift.
export const ROUTE_ACCESS = {
  "/": MARKETPLACE,
  "/suppliers": MARKETPLACE,
  "/suppliers/:supplierId": MARKETPLACE,
  "/businesses/new": ["buyer", "wholesaler"],
  "/cart": ["buyer", "wholesaler"], // admins never buy (POST /api/orders rejects them)
  "/orders": MARKETPLACE,
  "/invoices": MARKETPLACE,
  "/dashboard": ["wholesaler"], // a wholesaler's own sales workspace
  "/inventory": ["wholesaler", "platform_admin"],
  "/logistics": PARCEL_READERS,
  "/logistics/:parcelId": PARCEL_READERS,
  "/logistics/management": ["logistics_coordinator", "platform_admin"],
  "/courier": ["courier"],
  "/admin": ["platform_admin"],
  "/settings": [], // profile: every signed-in user
  // Location is a marketplace-business concern; admins edit one only through
  // a buyer/wholesaler membership of their own (mirrors backend settings.js).
  "/settings/business-location": ["buyer", "wholesaler"],
};

// In-page capabilities (buttons/forms), not routes.
export const ACTION_ACCESS = {
  assignParcel: ["logistics_coordinator", "platform_admin"],
  logParcelStatus: ["logistics_coordinator", "courier", "platform_admin"],
  editServiceTier: ["platform_admin"],
};

export const APP_NAV_ITEMS = [
  { name: "Home", link: "/", end: true },
  { name: "Dashboard", link: "/dashboard" },
  { name: "My Products", link: "/inventory" },
  { name: "Orders", link: "/orders" },
  { name: "Invoices", link: "/invoices" },
  { name: "Logistics", link: "/logistics" },
  { name: "Courier Dashboard", link: "/courier" },
  { name: "Admin", link: "/admin" },
].map((item) => ({ ...item, roles: ROUTE_ACCESS[item.link] }));

export function isPlatformAdmin(user) {
  return user?.global_role === "platform_admin";
}

// Stable display/label order for the additive roles of one business.
export const ROLE_ORDER = { buyer: 0, wholesaler: 1, logistics_coordinator: 2, courier: 3 };

// Single badge role: global admin wins, else the highest-priority active role.
export function primaryRole(user, activeRoles = []) {
  if (isPlatformAdmin(user)) return "platform_admin";
  return [...activeRoles].sort((a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99))[0] ?? null;
}

// Collapse flat membership rows ([{business_id, business_name, role}]) into one
// entry per unique business with its additive role set, roles sorted by
// ROLE_ORDER so combined labels are stable. One switcher option per business.
export function groupMemberships(memberships = []) {
  const byBusiness = new Map();
  for (const m of memberships) {
    const existing = byBusiness.get(m.business_id);
    if (existing) {
      if (!existing.roles.includes(m.role)) {
        existing.roles.push(m.role);
      }
    } else {
      byBusiness.set(m.business_id, {
        business_id: m.business_id,
        business_name: m.business_name,
        business_type: m.business_type ?? null,
        has_coordinates: m.has_coordinates ?? false,
        roles: [m.role],
      });
    }
  }
  const grouped = [...byBusiness.values()];
  for (const business of grouped) {
    business.roles.sort(
      (a, b) => (ROLE_ORDER[a] ?? 99) - (ROLE_ORDER[b] ?? 99),
    );
  }
  return grouped;
}

// Authorize against the active business's roles plus global platform-admin.
// `activeRoles` are the roles of the selected business only; roles from any
// unselected business grant nothing.
export function hasAccess(user, activeRoles = [], roles = []) {
  if (!user) {
    return false;
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return true;
  }

  if (isPlatformAdmin(user) && roles.includes("platform_admin")) {
    return true;
  }

  return activeRoles.some((role) => roles.includes(role));
}

// Where to land after login, register, or an invalidated route on switch.
// Marketplace roles win when mixed with operational ones.
export function redirectPathForRoles(activeRoles = [], isAdmin = false) {
  if (activeRoles.includes("buyer") || activeRoles.includes("wholesaler")) {
    return "/";
  }
  if (activeRoles.includes("logistics_coordinator")) {
    return "/logistics";
  }
  if (activeRoles.includes("courier")) {
    return "/courier";
  }
  if (isAdmin) {
    return "/admin";
  }
  // No usable role: land on the one page every signed-in user can open. Any
  // narrower target would bounce off its own guard and redirect-loop.
  return "/settings/profile";
}

// Post-login/register default path. The session's active business isn't in
// React state yet at submit time, so resolve it off the payload the same way
// AuthProvider does: stored selection if still valid, else the first business.
export function defaultPathForSession(payload, storedBusinessId) {
  const businesses = groupMemberships(payload?.memberships ?? []);
  const active =
    businesses.find(
      (b) => String(b.business_id) === String(storedBusinessId),
    ) ?? businesses[0] ?? null;
  return redirectPathForRoles(active?.roles ?? [], isPlatformAdmin(payload?.user));
}

export function formatRoleLabel(role) {
  if (!role) {
    return "Member";
  }

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
