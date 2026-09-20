import { z } from "zod";

export const PAYMENT_METHODS = ["eft", "cash", "card", "debit_order", "instant_eft", "other"] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  eft: "EFT",
  cash: "Cash",
  card: "Card",
  debit_order: "Debit Order",
  instant_eft: "Instant EFT",
  other: "Other",
};

export const invoiceAllocationSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

export const recordPaymentSchema = z.object({
  customer_id: z.string().uuid("Choose a customer."),
  payment_date: z.string().min(1, "Enter a payment date."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  payment_method: z.enum(PAYMENT_METHODS),
  bank_reference: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  notes: z.string().max(2000).default(""),
  invoice_allocations: z.array(invoiceAllocationSchema).default([]),
  bank_transaction_id: z.union([z.literal(""), z.string().uuid()]).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const applyCreditSchema = z.object({
  customer_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  notes: z.string().max(2000).default(""),
});
export type ApplyCreditInput = z.infer<typeof applyCreditSchema>;

export const paymentSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type PaymentSearchInput = z.infer<typeof paymentSearchSchema>;
