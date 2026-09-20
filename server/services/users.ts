import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import type { Profile } from "@/server/services/auth";

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw new Error("Unable to load users.");
  return data;
}

/**
 * Creates the auth user (service-role only — this is the one place the
 * admin client is used outside of pure audit logging) and emails them an
 * invite link to set their password. The `handle_new_auth_user` trigger
 * creates the matching profiles row automatically; role/permissions are
 * applied in a follow-up update once that row exists.
 */
export async function inviteUser(params: {
  email: string;
  fullName: string;
  role: Profile["role"];
  staffModulePermissions: Record<string, boolean>;
}): Promise<{ userId: string } | { error: string }> {
  const admin = createAdminSupabaseClient();
  const env = getServerEnv();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    redirectTo: `${env.APP_URL}/reset-password`,
    data: { full_name: params.fullName },
  });

  if (error || !data.user) {
    return { error: error?.message.includes("already registered") ? "That email is already in use." : "Unable to send the invite. Please try again." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: params.fullName,
      role: params.role,
      staff_module_permissions: params.staffModulePermissions,
    })
    .eq("id", data.user.id);

  if (profileError) {
    return { error: "The invite was sent, but the role could not be set. Edit the user to fix this." };
  }

  return { userId: data.user.id };
}
