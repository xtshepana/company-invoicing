"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import type { Profile } from "@/server/services/auth";

export function SidebarNav({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();
  const permissions = (profile.staff_module_permissions as Record<string, boolean> | null) ?? {};

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (profile.role === "owner_admin") return true;
    if (item.adminOnly) return false;
    if (!item.module) return true;
    if (profile.role === "accountant") return true;
    return Boolean(permissions[item.module]);
  });

  return (
    <nav className="flex flex-col gap-1 p-3">
      {visibleItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
