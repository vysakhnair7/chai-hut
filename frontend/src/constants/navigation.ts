import {
  BarChart3,
  Banknote,
  Coffee,
  Receipt,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types/auth";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Sidebar per role, exactly as specified. Routes are guarded with the same table. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  owner: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Customers", path: "/customers", icon: Users },
    { label: "Products & Menu", path: "/products", icon: Coffee },
    { label: "Orders", path: "/orders", icon: ClipboardList },
    { label: "Payments", path: "/payments", icon: Receipt },
    { label: "Outstanding Dues", path: "/dues", icon: Wallet },
    { label: "Expenses", path: "/expenses", icon: Banknote },
    { label: "Analytics & Reports", path: "/analytics", icon: BarChart3 },
    { label: "Employee Management", path: "/employees", icon: UserCog },
    { label: "Settings", path: "/settings", icon: Settings },
  ],
  manager: [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Customers", path: "/customers", icon: Users },
    { label: "Products & Menu", path: "/products", icon: Coffee },
    { label: "Orders", path: "/orders", icon: ClipboardList },
    { label: "Payments", path: "/payments", icon: Receipt },
    { label: "Outstanding Dues", path: "/dues", icon: Wallet },
    { label: "Expenses", path: "/expenses", icon: Banknote },
  ],
  cashier: [
    { label: "New Order", path: "/pos", icon: ShoppingCart },
    { label: "Customers", path: "/customers", icon: Users },
    { label: "Active Orders", path: "/orders", icon: ListChecks },
  ],
};

/** Every role may open its own account page (profile + change password). */
export const ACCOUNT_PATH = "/settings";

/** Where each role lands after login. */
export const HOME_BY_ROLE: Record<Role, string> = {
  owner: "/dashboard",
  manager: "/dashboard",
  cashier: "/pos",
};

export function canAccess(role: Role, path: string): boolean {
  if (path === ACCOUNT_PATH) return true;
  return NAV_BY_ROLE[role].some((item) => path === item.path || path.startsWith(`${item.path}/`));
}
