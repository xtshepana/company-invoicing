import type { DocumentData } from "@/lib/pdf/document-data";

/**
 * Which documents carry the company's banking details. Invoices (to be paid) and quotations (so a customer who accepts
 * knows where a deposit or the first payment goes) do; a credit note is money owed to the customer, not by them, so it
 * never does. One rule shared by every PDF template.
 */
export function showsBankingDetails(docKind: DocumentData["docKind"]): boolean {
  return docKind === "invoice" || docKind === "quote";
}
