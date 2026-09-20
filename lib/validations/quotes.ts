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

export const QUOTE_STATUS_LABELS: Record<(typeof QUOTE_STATUSES)[number], string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const QUOTE_STATUS_VARIANTS: Record<(typeof QUOTE_STATUSES)[number], "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
  cancelled: "destructive",
};

/**
 * A quote that's been converted to an invoice is tracked via
 * `converted_invoice_id`, not a distinct enum value — the underlying
 * `status` stays whatever it was at conversion time (typically
 * "accepted"). Display-wise this should read as "Converted", since
 * that's a first-class, distinct outcome from the user's perspective.
 */
export function getQuoteDisplayStatus(quote: {
  status: (typeof QUOTE_STATUSES)[number];
  converted_invoice_id: string | null;
}): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (quote.converted_invoice_id) return { label: "Converted", variant: "default" };
  return { label: QUOTE_STATUS_LABELS[quote.status], variant: QUOTE_STATUS_VARIANTS[quote.status] };
}

export const quoteSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...QUOTE_STATUSES, "all"] as const).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type QuoteSearchInput = z.infer<typeof quoteSearchSchema>;
