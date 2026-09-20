import { z } from "zod";

function firstOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const vatReportSearchSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(firstOfMonth),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
});
export type VatReportSearchInput = z.infer<typeof vatReportSearchSchema>;

export const agingReportSearchSchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
});
export type AgingReportSearchInput = z.infer<typeof agingReportSearchSchema>;

export const salesReportSearchSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(firstOfMonth),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
});
export type SalesReportSearchInput = z.infer<typeof salesReportSearchSchema>;

export const bankReconciliationReportSearchSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(firstOfMonth),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today),
});
export type BankReconciliationReportSearchInput = z.infer<typeof bankReconciliationReportSearchSchema>;
