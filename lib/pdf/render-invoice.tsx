import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { CompanySettings } from "@/lib/config/system-settings";

/** JSX must live in a .tsx file — this lets plain .ts server actions render an invoice PDF without becoming .tsx themselves. */
export async function renderInvoicePdf(invoice: InvoiceWithItems, settings: CompanySettings): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf invoice={invoice} settings={settings} />);
}
