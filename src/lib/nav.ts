/** Single source of truth for in-app navigation. Every href must be a real page (see tests/unit/routes.test.ts). */
export const APP_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "My Workbooks", href: "/workbooks" },
  { label: "Billing & Plan", href: "/billing" },
  { label: "Settings", href: "/settings" },
  { label: "Help & Support", href: "/help" },
] as const;

export const isActive = (path: string, href: string) =>
  path === href ||
  path.startsWith(`${href}/`) ||
  (href === "/workbooks" && path.startsWith("/workspace"));
