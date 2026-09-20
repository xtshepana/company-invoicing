import { z } from "zod";

export const CUSTOMER_TYPES = ["business", "individual"] as const;

export const customerSchema = z.object({
  customer_type: z.enum(CUSTOMER_TYPES),
  company_name: z.string().trim().min(1, "Name is required.").max(200),
  contact_person: z.string().trim().max(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]).default(""),
  phone: z.string().trim().max(50).default(""),
  mobile: z.string().trim().max(50).default(""),
  vat_number: z.string().trim().max(100).default(""),
  registration_number: z.string().trim().max(100).default(""),
  address_physical: z.string().trim().max(500).default(""),
  address_postal: z.string().trim().max(500).default(""),
  customer_reference: z.string().trim().max(100).default(""),
  payment_terms_days: z.union([z.literal(""), z.coerce.number().int().min(0).max(365)]).default(""),
  opening_balance: z.coerce.number().min(-999999999).max(999999999).default(0),
  notes: z.string().max(2000).default(""),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const customerSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z.enum(["name_asc", "name_desc", "newest", "oldest"]).default("name_asc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
