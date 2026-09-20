import { z } from "zod";

export const lineItemInputSchema = z.object({
  product_id: z.string().uuid().nullable().default(null),
  description: z.string().trim().min(1, "Each line item needs a description.").max(500),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unit_price: z.coerce.number().min(0, "Unit price cannot be negative."),
  discount_percent: z.coerce.number().min(0).max(100).default(0),
  vat_rate: z.coerce.number().min(0).max(100),
});
export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const lineItemsArraySchema = z.array(lineItemInputSchema).min(1, "Add at least one line item.");
