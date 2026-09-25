import { quoteToDocumentData } from "@/lib/pdf/document-data";
import { resolvePdfTemplate } from "@/lib/pdf/templates";
import type { QuoteWithItems } from "@/server/services/quotes";
import type { CompanySettings } from "@/lib/config/system-settings";

export function QuotePdf({ quote, settings }: { quote: QuoteWithItems; settings: CompanySettings }) {
  const render = resolvePdfTemplate(settings.pdf_template);
  return render({ data: quoteToDocumentData(quote), settings });
}
