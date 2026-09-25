import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { PDF_TEMPLATE_COMPONENTS } from "@/lib/pdf/templates";
import type { DocumentData } from "@/lib/pdf/document-data";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ template: string }>;
}

/** Fabricated sample document, shared by every template preview - real company settings (logo, brand color, bank details) with placeholder customer/line-item data, so a template can be judged before it's actually picked. */
function sampleDocumentData(): DocumentData {
  return {
    docKind: "invoice",
    docTitle: "INVOICE",
    number: "INV-000123",
    statusLabel: "Paid",
    metaFields: [
      { label: "Invoice number", value: "INV-000123" },
      { label: "Invoice date", value: "1 Jan 2026" },
      { label: "Due date", value: "31 Jan 2026" },
      { label: "Reference", value: "PO-4821" },
    ],
    billToLabel: "Bill To",
    customer: {
      name: "Sample Customer (Pty) Ltd",
      accountNo: "SAM001",
      contactPerson: "Jane Dlamini",
      address: "12 Example Street, Sandton, 2196",
      email: "accounts@samplecustomer.co.za",
      vatNumber: "4123456789",
    },
    lineItems: [
      { description: "Website design and development", quantity: 1, unitPrice: 15000, discountPercent: 0, vatRate: 15, lineTotal: 17250 },
      { description: "Monthly hosting and support", quantity: 3, unitPrice: 850, discountPercent: 0, vatRate: 15, lineTotal: 2932.5 },
      { description: "Domain registration", quantity: 1, unitPrice: 250, discountPercent: 10, vatRate: 15, lineTotal: 258.75 },
    ],
    totals: { subtotal: 18325, discount: 25, vat: 2691.25, total: 20991.25, amountPaid: 20991.25, balanceDue: 0 },
    notes: "Thank you for your business. Please reach out if you have any questions about this invoice.",
    terms: "Payment due within 30 days. Late payments may incur interest at 2% per month.",
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  // /api/* is excluded from proxy.ts's matcher, so this route verifies the
  // caller itself - never assume the proxy already checked auth here.
  // Same admin-only gate as the Settings page this preview is linked from.
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (profile.role !== "owner_admin") {
    return NextResponse.json({ error: "You do not have access to this preview." }, { status: 403 });
  }

  const { template } = await params;
  const render = PDF_TEMPLATE_COMPONENTS[template];
  if (!render) {
    return NextResponse.json({ error: "Unknown template." }, { status: 404 });
  }

  const settings = await getCompanySettings();
  const buffer = await renderToBuffer(render({ data: sampleDocumentData(), settings }));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="template-preview-${template}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
