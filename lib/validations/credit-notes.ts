import { z } from "zod";
import { lineItemsArraySchema } from "@/lib/validations/line-items";
import { CREDIT_NOTE_DEFAULT_SORT, CREDIT_NOTE_SORT_VALUES } from "@/lib/list-sort";

export const creditNoteSchema = z.object({
  customer_id: z.string().uuid("Choose a customer."),
  invoice_id: z.union([z.literal(""), z.string().uuid()]).optional(),
  credit_note_date: z.string().min(1, "Enter a credit note date."),
  reason: z.string().trim().max(500).default(""),
  prices_include_vat: z.boolean().default(false),
  notes: z.string().max(2000).default(""),
  terms: z.string().max(2000).default(""),
  line_items: lineItemsArraySchema,
});
export type CreditNoteInput = z.infer<typeof creditNoteSchema>;

export const CREDIT_NOTE_STATUSES = ["draft", "issued", "cancelled"] as const;

export const CREDIT_NOTE_STATUS_LABELS: Record<(typeof CREDIT_NOTE_STATUSES)[number], string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
};

export const creditNoteSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...CREDIT_NOTE_STATUSES, "all"] as const).default("all"),
  // An unknown value (old bookmark, edited link) falls back to the default rather than erroring the page.
  sort: z.enum(CREDIT_NOTE_SORT_VALUES).catch(CREDIT_NOTE_DEFAULT_SORT),
  page: z.coerce.number().int().min(1).default(1),
});
export type CreditNoteSearchInput = z.infer<typeof creditNoteSearchSchema>;
