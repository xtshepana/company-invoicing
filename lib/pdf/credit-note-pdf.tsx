import { creditNoteToDocumentData } from "@/lib/pdf/document-data";
import { resolvePdfTemplate } from "@/lib/pdf/templates";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";
import type { CompanySettings } from "@/lib/config/system-settings";

export function CreditNotePdf({ creditNote, settings }: { creditNote: CreditNoteWithItems; settings: CompanySettings }) {
  const render = resolvePdfTemplate(settings.pdf_template);
  return render({ data: creditNoteToDocumentData(creditNote), settings });
}
