"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requestClientMagicLink, requireClientSession, logoutClient } from "@/server/services/client-auth";
import { respondToClientQuote } from "@/server/services/client-portal";
import { clientLoginSchema, quoteResponseSchema } from "@/lib/validations/client-portal";
import type { ActionResult } from "@/server/actions/auth-actions";

/**
 * Always reports success regardless of whether the email matched any
 * customer or a resend cooldown is active - see requestClientMagicLink's
 * own doc comment. This cannot be used to find out which addresses have
 * portal access.
 */
export async function requestClientLoginAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = clientLoginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await requestClientMagicLink(parsed.data.email);
  return { success: true };
}

export async function respondToQuoteAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = quoteResponseSchema.safeParse({
    quote_id: formData.get("quote_id"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let session;
  try {
    session = await requireClientSession();
  } catch {
    return { error: "Your session has expired. Please sign in again." };
  }

  const result = await respondToClientQuote(session, parsed.data.quote_id, parsed.data.decision);
  if (result.error) return { error: result.error };

  revalidatePath(`/client/quotes/${parsed.data.quote_id}`);
  revalidatePath("/client");
  return { success: true };
}

export async function clientLogoutAction(): Promise<void> {
  await logoutClient();
  redirect("/client/login");
}
