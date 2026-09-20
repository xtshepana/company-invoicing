import { renderToBuffer } from "@react-pdf/renderer";
import { CreditNotePdf } from "@/lib/pdf/credit-note-pdf";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";
import type { CompanySettings } from "@/lib/config/system-settings";

/** JSX must live in a .tsx file — this lets plain .ts server actions render a credit note PDF without becoming .tsx themselves. */
export async function renderCreditNotePdf(creditNote: CreditNoteWithItems, settings: CompanySettings): Promise<Buffer> {
  return renderToBuffer(<CreditNotePdf creditNote={creditNote} settings={settings} />);
}
