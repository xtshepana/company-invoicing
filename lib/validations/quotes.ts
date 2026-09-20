import { z } from "zod";
import { lineItemsArraySchema } from "@/lib/validations/line-items";

export const quoteSchema = z.object({
  customer_id: z.string().uuid("Choose a customer."),
  quote_date: z.string().min(1, "Enter a quote date."),
  expiry_date: z.union([z.literal(""), z.string()]).default(""),
  reference: z.string().trim().max(200).default(""),
  prices_include_vat: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
  terms: z.string().max(2000).default(""),
  line_items: lineItemsArraySchema,
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected", "expired", "cancelled"] as const;

export const quoteSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...QUOTE_STATUSES, "all"] as const).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type QuoteSearchInput = z.infer<typeof quoteSearchSchema>;
