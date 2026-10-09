import { z } from "zod";

export const noticeContentSchema = z.object({
  subject: z.string().trim().min(1, "Enter a subject.").max(150, "Keep the subject under 150 characters."),
  body: z.string().trim().min(1, "Write the message.").max(10000, "The message is too long."),
});

export const sendNoticeSchema = noticeContentSchema.extend({
  customer_ids: z.array(z.string().uuid()).min(1, "Choose at least one customer.").max(500, "Too many customers selected."),
  send_token: z.string().uuid(),
});
export type SendNoticeInput = z.infer<typeof sendNoticeSchema>;
