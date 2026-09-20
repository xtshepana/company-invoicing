import { z } from "zod";

export const BANK_TRANSACTION_STATUSES = ["unmatched", "matched", "ignored"] as const;

export const BANK_TRANSACTION_STATUS_LABELS: Record<(typeof BANK_TRANSACTION_STATUSES)[number], string> = {
  unmatched: "Unmatched",
  matched: "Matched",
  ignored: "Ignored",
};

export const normalizedBankRowSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Each row needs a valid date."),
  description: z.string().trim().min(1, "Each row needs a description.").max(500),
  reference: z.string().trim().max(200).default(""),
  amount: z.coerce.number().refine((n) => n !== 0, "Amount cannot be zero."),
  balance_after: z.coerce.number().optional(),
});
export type NormalizedBankRow = z.infer<typeof normalizedBankRowSchema>;

export const importBankTransactionsSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  rows: z.array(normalizedBankRowSchema).min(1, "No rows to import."),
});
export type ImportBankTransactionsInput = z.infer<typeof importBankTransactionsSchema>;

export const bankTransactionSearchSchema = z.object({
  status: z.enum([...BANK_TRANSACTION_STATUSES, "all"] as const).default("unmatched"),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
});
export type BankTransactionSearchInput = z.infer<typeof bankTransactionSearchSchema>;
