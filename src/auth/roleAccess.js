export const ROLE_ACCESS = {
  dashboard: [],
  marketplace: ["buyer", "wholesaler", "platform_admin"],
  matching: ["buyer", "platform_admin"],
  inventory: ["wholesaler", "platform_admin"],
  orders: ["buyer", "wholesaler", "platform_admin"],
  invoices: ["buyer", "wholesaler", "platform_admin"],
  logistics: ["wholesaler", "logistics_coordinator", "courier", "platform_admin"],
  courier: ["courier"],
  admin: ["platform_admin"],
};

export const APP_NAV_ITEMS = [
  { name: "Home", link: "/", end: true, roles: ROLE_ACCESS.marketplace },
  { name: "Dashboard", link: "/dashboard", roles: ROLE_ACCESS.dashboard },
  { name: "Find Wholesalers", link: "/matching", roles: ROLE_ACCESS.matching },
  { name: "My Products", link: "/inventory", roles: ROLE_ACCESS.inventory },
  { name: "Orders", link: "/orders", roles: ROLE_ACCESS.orders },
  { name: "Invoices", link: "/invoices", roles: ROLE_ACCESS.invoices },
  { name: "Logistics", link: "/logistics", roles: ROLE_ACCESS.logistics },
  { name: "Courier Dashboard", link: "/courier", roles: ROLE_ACCESS.courier },
  { name: "Admin", link: "/admin", roles: ROLE_ACCESS.admin },
];

// Stable display/label order for the additive roles of one business.
export const ROLE_ORDER = { buyer: 0, wholesaler: 1, logistics_coordinator: 2, courier: 3 };

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

  if (user.global_role === "platform_admin") {
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
  return "/dashboard";
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
  const isAdmin = payload?.user?.global_role === "platform_admin";
  return redirectPathForRoles(active?.roles ?? [], isAdmin);
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
