import { z } from "zod";

export const USER_ROLES = ["owner_admin", "accountant", "staff"] as const;

export const ROLE_LABELS: Record<(typeof USER_ROLES)[number], string> = {
  owner_admin: "Owner / Admin",
  accountant: "Accountant",
  staff: "Staff",
};

export const STAFF_MODULES = [
  "customers",
  "products",
  "quotes",
  "invoices",
  "recurring_invoices",
  "payments",
  "banking",
  "reports",
  "suppliers",
] as const;

export const inviteUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  full_name: z.string().trim().min(1, "Enter a name.").max(200),
  role: z.enum(USER_ROLES),
  staff_module_permissions: z.record(z.string(), z.boolean()).default({}),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(USER_ROLES),
  staff_module_permissions: z.record(z.string(), z.boolean()).default({}),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const setUserActiveSchema = z.object({
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});
export type SetUserActiveInput = z.infer<typeof setUserActiveSchema>;
