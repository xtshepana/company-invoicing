/**
 * Sending many draft invoices in one go. The browser sends them to the server in small batches (so one click never
 * hits a request time limit, a progress bar can show, and the person can stop part-way); this file holds the pieces
 * that both sides share. Nothing here touches the database or sends anything.
 */

/** Invoices per server call. Each one renders a PDF and sends an email, so a small batch keeps a call to a few seconds. */
export const BULK_SEND_BATCH_SIZE = 5;

/** A draft invoice offered for sending. `email` is the customer's one valid address, or null when it can't be emailed. */
export interface DraftToSend {
  id: string;
  invoice_number: string;
  customer_name: string;
  email: string | null;
  total: number;
}

export type BulkSendStatus =
  /** Emailed, and now marked Sent. */
  | "sent"
  /** The email did not go out (or couldn't be built), so the invoice was put back to Draft to be retried. */
  | "failed"
  /** Left alone: no longer a draft, not found, or changed by someone else while sending. */
  | "skipped"
  /** The customer has no single valid email address, so nothing was sent. */
  | "no_email";

export interface BulkSendResult {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  status: BulkSendStatus;
  /** Why, for anything that was not sent. */
  detail?: string;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Splits drafts into those that can be emailed and those that can't (no valid address). */
export function splitSendable(drafts: readonly DraftToSend[]): { sendable: DraftToSend[]; blocked: DraftToSend[] } {
  return {
    sendable: drafts.filter((draft) => draft.email !== null),
    blocked: drafts.filter((draft) => draft.email === null),
  };
}

export interface BulkSendSummary {
  sent: number;
  failed: number;
  skipped: number;
  noEmail: number;
  /** Everything that was not sent, for showing the person what needs attention. */
  problems: BulkSendResult[];
}

export function summarizeBulkSend(results: readonly BulkSendResult[]): BulkSendSummary {
  const count = (status: BulkSendStatus) => results.filter((result) => result.status === status).length;
  return {
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("skipped"),
    noEmail: count("no_email"),
    problems: results.filter((result) => result.status !== "sent"),
  };
}
