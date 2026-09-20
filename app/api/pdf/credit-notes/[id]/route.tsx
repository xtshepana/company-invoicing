import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCreditNoteById } from "@/server/services/credit-notes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { CreditNotePdf } from "@/lib/pdf/credit-note-pdf";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  // /api/* is excluded from proxy.ts's matcher, so this route verifies the
  // caller itself — never assume the proxy already checked auth here.
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "invoices")) {
    return NextResponse.json({ error: "You do not have access to credit notes." }, { status: 403 });
  }

  const { id } = await params;
  const creditNote = await getCreditNoteById(id);
  if (!creditNote) {
    return NextResponse.json({ error: "Credit note not found." }, { status: 404 });
  }

  const settings = await getCompanySettings();
  const buffer = await renderToBuffer(<CreditNotePdf creditNote={creditNote} settings={settings} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${creditNote.credit_note_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
