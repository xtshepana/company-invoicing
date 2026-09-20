import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

export class UnauthenticatedError extends Error {
  constructor() {
    super("You must be signed in to do that.");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Returns the signed-in user's profile, or null. This is the single source
 * of truth for "who is the caller and what is their role" — never derive
 * role from client state, a cookie, or a JWT claim.
 *
 * Wrapped in React's cache() so the layout and every page it renders share
 * one auth.getUser() + profiles lookup per request instead of repeating it
 * at every call site — this function alone is called from ~80 places.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile ?? null;
});

/** Throws UnauthenticatedError if not signed in, ForbiddenError if the account is deactivated. */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new UnauthenticatedError();
  if (!profile.is_active) {
    throw new ForbiddenError("Your account has been deactivated. Contact an administrator.");
  }
  return profile;
}

/** Throws unless the caller is an active owner_admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "owner_admin") {
    throw new ForbiddenError("This action requires administrator access.");
  }
  return profile;
}

/** Throws unless the caller is an active owner_admin or accountant. */
export async function requireAccountingAccess(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "owner_admin" && profile.role !== "accountant") {
    throw new ForbiddenError("This action requires accountant or administrator access.");
  }
  return profile;
}

export type StaffModule =
  | "customers"
  | "products"
  | "quotes"
  | "invoices"
  | "recurring_invoices"
  | "payments"
  | "banking"
  | "reports";

/** Pure check, safe to use for a page-level redirect (no throw). */
export function hasModuleAccess(profile: Profile, module: StaffModule): boolean {
  if (profile.role === "owner_admin" || profile.role === "accountant") return true;
  const permissions = profile.staff_module_permissions as Record<string, boolean> | null;
  return Boolean(permissions?.[module]);
}

/**
 * Owner_admin and accountant always pass. A "staff" role only passes for
 * modules explicitly enabled in `profiles.staff_module_permissions`.
 */
export async function requireModuleAccess(module: StaffModule): Promise<Profile> {
  const profile = await requireUser();
  if (!hasModuleAccess(profile, module)) {
    throw new ForbiddenError(`You do not have access to the ${module.replace("_", " ")} module.`);
  }
  return profile;
}
