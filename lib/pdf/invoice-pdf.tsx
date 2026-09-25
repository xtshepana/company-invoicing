import { invoiceToDocumentData } from "@/lib/pdf/document-data";
import { resolvePdfTemplate } from "@/lib/pdf/templates";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { CompanySettings } from "@/lib/config/system-settings";

export function InvoicePdf({ invoice, settings }: { invoice: InvoiceWithItems; settings: CompanySettings }) {
  const render = resolvePdfTemplate(settings.pdf_template);
  return render({ data: invoiceToDocumentData(invoice), settings });
}
