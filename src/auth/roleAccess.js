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
  { name: "Wait List", link: "/waitlist", roles: ROLE_ACCESS.marketplace },
  { name: "Logistics", link: "/logistics", roles: ROLE_ACCESS.logistics },
  { name: "Courier Dashboard", link: "/courier", roles: ROLE_ACCESS.courier },
  { name: "Admin", link: "/admin", roles: ROLE_ACCESS.admin },
];

export function hasAccess(user, memberships, roles = []) {
  if (!user) {
    return false;
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return true;
  }

  if (user.global_role === "platform_admin") {
    return true;
  }

  return memberships.some((membership) => roles.includes(membership.role));
}

export function getPrimaryMembership(memberships = []) {
  return Array.isArray(memberships) && memberships.length > 0 ? memberships[0] : null;
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
