import { z } from "zod";

export const clientLoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
export type ClientLoginInput = z.infer<typeof clientLoginSchema>;

export const quoteResponseSchema = z.object({
  quote_id: z.string().uuid(),
  decision: z.enum(["accepted", "rejected"]),
});
export type QuoteResponseInput = z.infer<typeof quoteResponseSchema>;
