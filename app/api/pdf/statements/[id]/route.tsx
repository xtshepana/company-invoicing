import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerStatement } from "@/server/services/statements";
import { getCompanySettings } from "@/lib/config/system-settings";
import { StatementPdf } from "@/lib/pdf/statement-pdf";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "customers") || !hasModuleAccess(profile, "payments")) {
    return NextResponse.json({ error: "You do not have access to customer statements." }, { status: 403 });
  }

  const { id } = await params;
  const statement = await getCustomerStatement(id);
  if (!statement) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const settings = await getCompanySettings();
  const buffer = await renderToBuffer(<StatementPdf statement={statement} settings={settings} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${statement.customer.company_name.replace(/[^a-z0-9]+/gi, "-")}-statement.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
