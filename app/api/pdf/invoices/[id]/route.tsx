import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getInvoiceById } from "@/server/services/invoices";
import { getCompanySettings } from "@/lib/config/system-settings";
import { InvoicePdf } from "@/lib/pdf/invoice-pdf";

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
    return NextResponse.json({ error: "You do not have access to invoices." }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const settings = await getCompanySettings();
  const buffer = await renderToBuffer(<InvoicePdf invoice={invoice} settings={settings} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
