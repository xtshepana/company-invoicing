"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/services/auth";
import { sendNotice, sendNoticeTest } from "@/server/services/notices";
import { noticeContentSchema, sendNoticeSchema } from "@/lib/validations/notices";
import type { ActionResult } from "@/server/actions/auth-actions";

export interface NoticeActionResult extends ActionResult {
  /** The new notice's id, so the browser can open its delivery report. */
  id?: string;
}

function parseCustomerIds(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("customer_ids") ?? "[]"));
  } catch {
    return [];
  }
}

/** Emails a real notice to the chosen customers. Owner/admin only - this reaches every customer's inbox. */
export async function sendNoticeAction(_prev: NoticeActionResult, formData: FormData): Promise<NoticeActionResult> {
  const actor = await requireAdmin();

  const parsed = sendNoticeSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    customer_ids: parseCustomerIds(formData),
    send_token: formData.get("send_token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await sendNotice({
    actor,
    subject: parsed.data.subject,
    body: parsed.data.body,
    customerIds: parsed.data.customer_ids,
    sendToken: parsed.data.send_token,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/notices");
  return { success: true, id: result.id };
}

/** Sends one copy of the notice, with sample customer details, to the signed-in admin only. */
export async function sendNoticeTestAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();

  const parsed = noticeContentSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await sendNoticeTest({ actor, subject: parsed.data.subject, body: parsed.data.body });
  if (!result.ok) return { error: result.error };
  return { success: true };
}
