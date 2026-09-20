import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getQuoteById } from "@/server/services/quotes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { QuotePdf } from "@/lib/pdf/quote-pdf";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "quotes")) {
    return NextResponse.json({ error: "You do not have access to quotes." }, { status: 403 });
  }

  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  const settings = await getCompanySettings();
  const buffer = await renderToBuffer(<QuotePdf quote={quote} settings={settings} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quote_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
