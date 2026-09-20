"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { inviteUser } from "@/server/services/users";
import { inviteUserSchema, setUserActiveSchema, updateUserRoleSchema } from "@/lib/validations/users";
import type { ActionResult } from "@/server/actions/auth-actions";

function parsePermissions(formData: FormData): Record<string, boolean> {
  const raw = formData.get("staff_module_permissions");
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export async function inviteUserAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = inviteUserSchema.safeParse({
    email: formData.get("email"),
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    staff_module_permissions: parsePermissions(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = await requireAdmin();
  const result = await inviteUser({
    email: parsed.data.email,
    fullName: parsed.data.full_name,
    role: parsed.data.role,
    staffModulePermissions: parsed.data.staff_module_permissions,
  });

  if ("error" in result) {
    return { error: result.error };
  }

  await recordAuditLog({
    userId: admin.id,
    action: "user.invited",
    entity: "profiles",
    entityId: result.userId,
    newValue: { email: parsed.data.email, role: parsed.data.role },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function updateUserRoleAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = updateUserRoleSchema.safeParse({
    user_id: formData.get("user_id"),
    role: formData.get("role"),
    staff_module_permissions: parsePermissions(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.user_id === admin.id && parsed.data.role !== "owner_admin") {
    return { error: "You cannot remove your own administrator access." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("profiles").select("*").eq("id", parsed.data.user_id).single();

  const { error } = await supabase
    .from("profiles")
    .update({
      role: parsed.data.role,
      staff_module_permissions: parsed.data.staff_module_permissions,
    })
    .eq("id", parsed.data.user_id);

  if (error) {
    return { error: "Unable to update this user. Please try again." };
  }

  await recordAuditLog({
    userId: admin.id,
    action: "user.role_updated",
    entity: "profiles",
    entityId: parsed.data.user_id,
    oldValue: before ? { role: before.role, staff_module_permissions: before.staff_module_permissions } : null,
    newValue: { role: parsed.data.role, staff_module_permissions: parsed.data.staff_module_permissions },
  });

  revalidatePath("/users");
  return { success: true };
}

export async function setUserActiveAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = setUserActiveSchema.safeParse({
    user_id: formData.get("user_id"),
    is_active: formData.get("is_active") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  if (parsed.data.user_id === admin.id && !parsed.data.is_active) {
    return { error: "You cannot deactivate your own account." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.user_id);

  if (error) {
    return { error: "Unable to update this user. Please try again." };
  }

  await recordAuditLog({
    userId: admin.id,
    action: parsed.data.is_active ? "user.reactivated" : "user.deactivated",
    entity: "profiles",
    entityId: parsed.data.user_id,
    newValue: { is_active: parsed.data.is_active },
  });

  revalidatePath("/users");
  return { success: true };
}
