import { z } from "zod";

export const supplierSchema = z.object({
  company_name: z.string().trim().min(1, "Name is required.").max(200),
  contact_person: z.string().trim().max(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]).default(""),
  phone: z.string().trim().max(50).default(""),
  vat_number: z.string().trim().max(100).default(""),
  address_physical: z.string().trim().max(500).default(""),
  notes: z.string().max(2000).default(""),
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const supplierSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  sort: z.enum(["name_asc", "name_desc", "newest", "oldest"]).default("name_asc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type SupplierSearchInput = z.infer<typeof supplierSearchSchema>;

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries",
  "Office supplies",
  "Software & subscriptions",
  "Travel",
  "Marketing",
  "Professional fees",
  "Other",
] as const;

export const expenseSchema = z.object({
  supplier_id: z.union([z.literal(""), z.string().uuid()]).default(""),
  expense_date: z.string().trim().min(1, "Date is required."),
  description: z.string().trim().min(1, "Description is required.").max(500),
  category: z.string().trim().max(100).default(""),
  amount: z.coerce.number().min(0, "Amount must be positive.").max(999999999),
  notes: z.string().max(2000).default(""),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const expenseSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  sort: z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"]).default("date_desc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ExpenseSearchInput = z.infer<typeof expenseSearchSchema>;
