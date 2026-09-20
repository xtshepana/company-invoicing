"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import type { Profile } from "@/server/services/auth";

export function AppShell({
  profile,
  companyName,
  children,
}: {
  profile: Profile;
  companyName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-muted/20">
      <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Building2 className="h-5 w-5" />
          <span className="truncate">{companyName}</span>
        </div>
        <SidebarNav profile={profile} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu" />}>
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
                <Building2 className="h-5 w-5" />
                <span className="truncate">{companyName}</span>
              </SheetTitle>
              <SidebarNav profile={profile} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link href="/dashboard" className="font-semibold md:hidden">
            {companyName}
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu profile={profile} />
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
