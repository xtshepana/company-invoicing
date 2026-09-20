import { z } from "zod";
import { lineItemsArraySchema } from "@/lib/validations/line-items";

export const RECURRING_FREQUENCIES = [
  "weekly",
  "monthly",
  "every_2_months",
  "quarterly",
  "every_6_months",
  "annually",
  "custom",
] as const;

export const RECURRING_FREQUENCY_LABELS: Record<(typeof RECURRING_FREQUENCIES)[number], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  every_2_months: "Every 2 months",
  quarterly: "Quarterly",
  every_6_months: "Every 6 months",
  annually: "Annually",
  custom: "Custom",
};

export const recurringInvoiceSchema = z
  .object({
    customer_id: z.string().uuid("Choose a customer."),
    description: z.string().trim().min(1, "Enter a description.").max(200),
    frequency: z.enum(RECURRING_FREQUENCIES),
    custom_interval_days: z.union([z.literal(""), z.coerce.number().int().positive()]).default(""),
    start_date: z.string().min(1, "Enter a start date."),
    end_date: z.union([z.literal(""), z.string()]).default(""),
    payment_terms_days: z.union([z.literal(""), z.coerce.number().int().min(0)]).default(""),
    prices_include_vat: z.boolean().default(false),
    auto_generate: z.boolean().default(true),
    auto_send_email: z.boolean().default(false),
    notes: z.string().max(2000).default(""),
    terms: z.string().max(2000).default(""),
    line_items: lineItemsArraySchema,
  })
  .refine((data) => data.frequency !== "custom" || data.custom_interval_days !== "", {
    message: "Enter a custom interval in days.",
    path: ["custom_interval_days"],
  });
export type RecurringInvoiceInput = z.infer<typeof recurringInvoiceSchema>;

export const RECURRING_STATUSES = ["active", "paused", "cancelled"] as const;

export const recurringInvoiceSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum([...RECURRING_STATUSES, "all"] as const).default("active"),
  page: z.coerce.number().int().min(1).default(1),
});
export type RecurringInvoiceSearchInput = z.infer<typeof recurringInvoiceSearchSchema>;
