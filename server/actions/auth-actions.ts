"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { recordAuditLog } from "@/server/services/audit";
import { requireUser } from "@/server/services/auth";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function loginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Incorrect email or password." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Your account has been deactivated. Contact an administrator." };
  }

  await recordAuditLog({
    userId: data.user.id,
    action: "user.login",
    entity: "auth",
    entityId: data.user.id,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await recordAuditLog({ userId: user.id, action: "user.logout", entity: "auth", entityId: user.id });
  }

  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const env = getServerEnv();

  // Always report success regardless of whether the email exists, so this
  // cannot be used to enumerate staff accounts.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.APP_URL}/reset-password`,
  });

  return { success: true };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your password reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: "Unable to reset your password. Please try again." };
  }

  await recordAuditLog({ userId: user.id, action: "user.password_reset", entity: "auth", entityId: user.id });

  redirect("/dashboard");
}

export async function changePasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();

  // Re-verify the current password before allowing the change.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return { error: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) {
    return { error: "Unable to change your password. Please try again." };
  }

  await recordAuditLog({ userId: profile.id, action: "user.password_changed", entity: "auth", entityId: profile.id });

  return { success: true };
}
