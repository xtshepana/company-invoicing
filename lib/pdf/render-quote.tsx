import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdf } from "@/lib/pdf/quote-pdf";
import type { QuoteWithItems } from "@/server/services/quotes";
import type { CompanySettings } from "@/lib/config/system-settings";

/** JSX must live in a .tsx file — this lets plain .ts server actions render a quote PDF without becoming .tsx themselves. */
export async function renderQuotePdf(quote: QuoteWithItems, settings: CompanySettings): Promise<Buffer> {
  return renderToBuffer(<QuotePdf quote={quote} settings={settings} />);
}
