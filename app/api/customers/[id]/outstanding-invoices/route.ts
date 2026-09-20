import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerOutstandingInvoices } from "@/server/services/payments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  // /api/* is excluded from proxy.ts's matcher — this route checks the
  // caller itself, same as the PDF routes.
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "payments")) {
    return NextResponse.json({ error: "You do not have access to payments." }, { status: 403 });
  }

  const { id } = await params;
  const invoices = await getCustomerOutstandingInvoices(id);
  return NextResponse.json({ invoices });
}
