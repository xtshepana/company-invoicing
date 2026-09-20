"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import type { ActionResult } from "@/server/actions/auth-actions";

const updateNameSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name.").max(200),
});

export async function updateOwnProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireUser();
  const parsed = updateNameSchema.safeParse({ full_name: formData.get("full_name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", profile.id);

  if (error) {
    return { error: "Unable to save your profile. Please try again." };
  }

  await recordAuditLog({
    userId: profile.id,
    action: "profile.updated",
    entity: "profiles",
    entityId: profile.id,
    oldValue: { full_name: profile.full_name },
    newValue: { full_name: parsed.data.full_name },
  });

  revalidatePath("/settings/profile");
  return { success: true };
}
