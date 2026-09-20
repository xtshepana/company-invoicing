import { z } from "zod";

export const PRODUCT_TYPES = ["product", "service"] as const;

export const productSchema = z.object({
  type: z.enum(PRODUCT_TYPES),
  name: z.string().trim().min(1, "Name is required.").max(200),
  sku: z.string().trim().max(100).default(""),
  description: z.string().trim().max(2000).default(""),
  cost_price: z.union([z.literal(""), z.coerce.number().min(0).max(999999999)]).default(""),
  selling_price: z.coerce.number().min(0).max(999999999),
  vat_rate: z.coerce.number().min(0).max(100),
  unit: z.string().trim().min(1).max(50).default("each"),
});
export type ProductInput = z.infer<typeof productSchema>;

export const productSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.enum(["product", "service", "all"]).default("all"),
  status: z.enum(["active", "archived", "all"]).default("active"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ProductSearchInput = z.infer<typeof productSearchSchema>;
