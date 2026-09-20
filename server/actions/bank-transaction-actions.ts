"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { importBankTransactionsSchema } from "@/lib/validations/bank-transactions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Json } from "@/types/database";

export interface ImportActionResult extends ActionResult {
  batchId?: string;
  importedCount?: number;
  duplicateCount?: number;
}

export async function importBankTransactionsAction(filename: string, rows: unknown): Promise<ImportActionResult> {
  const actor = await requireModuleAccess("banking");

  const parsed = importBankTransactionsSchema.safeParse({ filename, rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import data." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("import_bank_transactions", {
      p_filename: parsed.data.filename,
      p_rows: parsed.data.rows as unknown as Json,
    })
    .single();

  if (error || !data) {
    return { error: "Unable to import this statement. Please try again." };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transactions.imported",
    entity: "bank_import_batches",
    entityId: data.batch_id,
    newValue: {
      filename: parsed.data.filename,
      imported_count: data.imported_count,
      duplicate_count: data.duplicate_count,
    } as unknown as Json,
  });

  revalidatePath("/bank-reconciliation");
  return {
    success: true,
    batchId: data.batch_id,
    importedCount: data.imported_count,
    duplicateCount: data.duplicate_count,
  };
}

export async function matchBankTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("banking");
  const transactionId = formData.get("transaction_id");
  const paymentId = formData.get("payment_id");
  if (typeof transactionId !== "string" || !transactionId || typeof paymentId !== "string" || !paymentId) {
    return { error: "Missing transaction or payment." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("match_bank_transaction", {
    p_transaction_id: transactionId,
    p_payment_id: paymentId,
  });

  if (error) {
    return {
      error: error.message.includes("already matched") ? error.message : "Unable to match this transaction. Please try again.",
    };
  }

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transaction.matched",
    entity: "bank_transactions",
    entityId: transactionId,
    newValue: { payment_id: paymentId },
  });

  revalidatePath("/bank-reconciliation");
  return { success: true };
}

export async function unmatchBankTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("banking");
  const transactionId = formData.get("transaction_id");
  if (typeof transactionId !== "string" || !transactionId) return { error: "Missing transaction." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("unmatch_bank_transaction", { p_transaction_id: transactionId });
  if (error) return { error: "Unable to unmatch this transaction. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transaction.unmatched",
    entity: "bank_transactions",
    entityId: transactionId,
  });

  revalidatePath("/bank-reconciliation");
  return { success: true };
}

export async function ignoreBankTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("banking");
  const transactionId = formData.get("transaction_id");
  if (typeof transactionId !== "string" || !transactionId) return { error: "Missing transaction." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ status: "ignored" })
    .eq("id", transactionId)
    .eq("status", "unmatched");
  if (error) return { error: "Unable to ignore this transaction. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transaction.ignored",
    entity: "bank_transactions",
    entityId: transactionId,
  });

  revalidatePath("/bank-reconciliation");
  return { success: true };
}

export async function restoreBankTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireModuleAccess("banking");
  const transactionId = formData.get("transaction_id");
  if (typeof transactionId !== "string" || !transactionId) return { error: "Missing transaction." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ status: "unmatched" })
    .eq("id", transactionId)
    .eq("status", "ignored");
  if (error) return { error: "Unable to restore this transaction. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transaction.restored",
    entity: "bank_transactions",
    entityId: transactionId,
  });

  revalidatePath("/bank-reconciliation");
  return { success: true };
}

export interface AutoMatchResult extends ActionResult {
  matchedCount?: number;
}

export async function autoMatchBankTransactionsAction(batchId?: string): Promise<AutoMatchResult> {
  const actor = await requireModuleAccess("banking");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("auto_match_bank_transactions", { p_batch_id: batchId ?? null });
  if (error) return { error: "Unable to run automatic matching. Please try again." };

  await recordAuditLog({
    userId: actor.id,
    action: "bank_transactions.auto_matched",
    entity: "bank_transactions",
    newValue: { matched_count: data ?? 0, batch_id: batchId ?? null },
  });

  revalidatePath("/bank-reconciliation");
  return { success: true, matchedCount: data ?? 0 };
}
