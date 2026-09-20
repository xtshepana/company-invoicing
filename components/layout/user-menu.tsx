"use client";

import { LogOut, User as UserIcon, KeyRound } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/actions/auth-actions";
import type { Profile } from "@/server/services/auth";

function initials(name: string, email: string) {
  const source = name.trim() || email;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const ROLE_LABELS: Record<Profile["role"], string> = {
  owner_admin: "Owner / Admin",
  accountant: "Accountant",
  staff: "Staff",
};

export function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 w-9 rounded-full p-0" aria-label="Account menu" />}>
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials(profile.full_name, profile.email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{profile.full_name || profile.email}</span>
          <span className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[profile.role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/profile" />}>
          <UserIcon /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/profile#change-password" />}>
          <KeyRound /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" render={<form action={logoutAction} className="w-full" />}>
          <button type="submit" className="flex w-full items-center gap-2">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
