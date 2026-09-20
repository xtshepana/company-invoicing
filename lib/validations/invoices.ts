import { z } from "zod";
import { lineItemsArraySchema } from "@/lib/validations/line-items";

export const invoiceSchema = z.object({
  customer_id: z.string().uuid("Choose a customer."),
  invoice_date: z.string().min(1, "Enter an invoice date."),
  due_date: z.string().min(1, "Enter a due date."),
  reference: z.string().trim().max(200).default(""),
  prices_include_vat: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
  terms: z.string().max(2000).default(""),
  line_items: lineItemsArraySchema,
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "cancelled", "void"] as const;

export const invoiceSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...INVOICE_STATUSES, "all", "overdue"] as const).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type InvoiceSearchInput = z.infer<typeof invoiceSearchSchema>;
