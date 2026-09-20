import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Settings,
  Users,
  ScrollText,
  Contact,
  Package,
  FileText,
  Receipt,
  Banknote,
  Repeat,
  Landmark,
  FileMinus,
  BarChart3,
} from "lucide-react";
import type { StaffModule } from "@/server/services/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omit for items every active staff member can see (e.g. Dashboard). */
  module?: StaffModule;
  adminOnly?: boolean;
}

/**
 * Only routes that exist are listed here — this list grows with each
 * build phase. Never link to a page that isn't built yet.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Contact, module: "customers" },
  { href: "/products", label: "Products & Services", icon: Package, module: "products" },
  { href: "/quotes", label: "Quotes", icon: FileText, module: "quotes" },
  { href: "/invoices", label: "Invoices", icon: Receipt, module: "invoices" },
  { href: "/credit-notes", label: "Credit Notes", icon: FileMinus, module: "invoices" },
  { href: "/recurring-invoices", label: "Recurring Invoices", icon: Repeat, module: "recurring_invoices" },
  { href: "/payments", label: "Payments", icon: Banknote, module: "payments" },
  { href: "/bank-reconciliation", label: "Bank Reconciliation", icon: Landmark, module: "banking" },
  { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/audit-log", label: "Audit Log", icon: ScrollText, adminOnly: true },
];
