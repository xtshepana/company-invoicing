import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getBankTransactionById, listCandidatePayments } from "@/server/services/bank-transactions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  // /api/* is excluded from proxy.ts's matcher — this route checks the
  // caller itself, same as the outstanding-invoices route.
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "banking")) {
    return NextResponse.json({ error: "You do not have access to banking." }, { status: 403 });
  }

  const { id } = await params;
  const transaction = await getBankTransactionById(id);
  if (!transaction) {
    return NextResponse.json({ error: "Bank transaction not found." }, { status: 404 });
  }

  const candidates = await listCandidatePayments(transaction.amount, transaction.transaction_date);
  return NextResponse.json({ candidates });
}
