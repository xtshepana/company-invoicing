import type { DocumentData } from "@/lib/pdf/document-data";

/**
 * The title printed on an invoice / credit note / quote PDF, shared by every template.
 * A VAT-registered supplier must issue a "Tax Invoice" (and a tax credit note); a company that is not VAT-registered
 * issues a plain Invoice. Quotations are not tax documents. Returned in Title Case - templates that print
 * capitals apply toUpperCase() themselves.
 */
export function documentTitle(docKind: DocumentData["docKind"], vatRegistered: boolean): string {
  switch (docKind) {
    case "invoice":
      return vatRegistered ? "Tax Invoice" : "Invoice";
    case "credit_note":
      return vatRegistered ? "Tax Credit Note" : "Credit Note";
    case "quote":
      return "Quotation";
  }
}
