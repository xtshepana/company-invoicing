import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getBankReconciliationReport } from "@/server/services/reports";
import { bankReconciliationReportSearchSchema } from "@/lib/validations/reports";
import { toDbNumeric } from "@/lib/money";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!hasModuleAccess(profile, "reports")) {
    return NextResponse.json({ error: "You do not have access to reports." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const params = bankReconciliationReportSearchSchema.parse(Object.fromEntries(searchParams));
  const report = await getBankReconciliationReport(params.start, params.end);

  const statusLabel = (status: string) => (status === "matched" ? "Matched" : status === "ignored" ? "Ignored" : "Unmatched");

  const rows = [
    ["Date", "Description", "Reference", "Amount", "Status", "Matched customer"],
    ...report.rows.map((row) => [
      row.date,
      row.description,
      row.reference,
      toDbNumeric(row.amount),
      statusLabel(row.status),
      row.matchedCustomerName ?? "",
    ]),
    [],
    ["Summary"],
    ["Matched", report.matchedCount, toDbNumeric(report.matchedAmount)],
    ["Unmatched", report.unmatchedCount, toDbNumeric(report.unmatchedAmount)],
    ["Ignored", report.ignoredCount, toDbNumeric(report.ignoredAmount)],
  ];
  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bank-reconciliation-report-${params.start}-to-${params.end}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
