/**
 * Central server-side role and permission policy for SARINE admin APIs.
 * The legacy "admin" role is treated as the primary Owner role for backwards compatibility.
 */
const ROLE_PERMISSIONS = Object.freeze({
  owner: ["*"],
  admin: ["*"],
  operations_manager: [
    "dashboard:read", "analytics:read", "orders:read", "orders:write",
    "returns:read", "returns:write", "refunds:read", "refunds:write",
    "inventory:read", "inventory:write", "customers:read", "customers:write",
    "contact:read", "contact:write"
  ],
  catalogue_manager: [
    "dashboard:read", "products:read", "products:write",
    "categories:read", "categories:write", "media:read", "media:write",
    "inventory:read"
  ],
  marketing_manager: [
    "dashboard:read", "marketing:read", "marketing:write",
    "storefront:read", "storefront:write", "pages:read", "pages:write"
  ],
  support_staff: [
    "dashboard:read", "orders:read", "customers:read", "contact:read"
  ]
});

const ROLE_LABELS = Object.freeze({
  owner: "Owner",
  admin: "Owner",
  operations_manager: "Operations Manager",
  catalogue_manager: "Catalogue Manager",
  marketing_manager: "Marketing Manager",
  support_staff: "Support Staff"
});

export const ADMIN_ROLES = Object.freeze([
  "operations_manager", "catalogue_manager", "marketing_manager", "support_staff"
]);

export function normalizeAdminRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" ? "owner" : normalized;
}

export function adminRoleLabel(role) {
  return ROLE_LABELS[normalizeAdminRole(role)] || "Restricted";
}

function permissionForRequest(pathname, method) {
  const path = pathname.replace(/^\\/api\\/admin/, "").replace(/^\\/+|\\/+$/g, "");
  const segments = path.split("/");
  const section = segments[0] || "";
  const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  const action = write ? "write" : "read";

  if (section === "auth" || section === "activity") return "owner:only";
  if (section === "dashboard") return "dashboard:read";
  if (section === "analytics") return "analytics:read";
  if (section === "orders") return `orders:${action}`;
  if (section === "returns") return `returns:${action}`;
  if (section === "refunds") return `refunds:${action}`;
  if (section === "inventory" || section === "inventory-settings") return `inventory:${action}`;
  if (section === "products") return `products:${action}`;
  if (section === "categories") return `categories:${action}`;
  if (section === "media") return `media:${action}`;
  if (section === "customers" || section === "customer-auth") return `customers:${action}`;
  if (section === "contact-inquiries") return `contact:${action}`;
  if (section === "marketing") return `marketing:${action}`;
  if (["storefront", "homepage-layout", "curated-favourites", "explore-now"].includes(section)) return `storefront:${action}`;
  if (section === "pages") return `pages:${action}`;
  if (section === "database-audit") return "owner:only";
  return "owner:only";
}

export function requireAdminPermission(req, res, next) {
  const role = normalizeAdminRole(req.admin?.role);
  const permissions = ROLE_PERMISSIONS[role] || [];
  const required = permissionForRequest(req.path, req.method);
  const allowed = permissions.includes("*") || permissions.includes(required);

  if (!allowed) {
    return res.status(403).json({
      error: "Forbidden: your administrator role does not have permission for this action."
    });
  }

  next();
}

export function requireOwner(req, res, next) {
  if (normalizeAdminRole(req.admin?.role) !== "owner") {
    return res.status(403).json({ error: "Forbidden: Owner access is required." });
  }
  next();
}
