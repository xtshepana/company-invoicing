import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getVatReport } from "@/server/services/reports";
import { vatReportSearchSchema } from "@/lib/validations/reports";
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
  const params = vatReportSearchSchema.parse(Object.fromEntries(searchParams));
  const report = await getVatReport(params.start, params.end);

  const rows = [
    ["Date", "Type", "Number", "Customer", "Excl. VAT", "VAT", "Total"],
    ...report.rows.map((row) => {
      const sign = row.documentType === "credit_note" ? -1 : 1;
      return [
        row.date,
        row.documentType === "invoice" ? "Invoice" : "Credit Note",
        row.documentNumber,
        row.customerName,
        toDbNumeric(sign * row.subtotal),
        toDbNumeric(sign * row.vatAmount),
        toDbNumeric(sign * row.total),
      ];
    }),
    [],
    ["Sales (excl. VAT)", toDbNumeric(report.salesExclVat)],
    ["Output VAT", toDbNumeric(report.outputVat)],
    ["Credit notes VAT", toDbNumeric(-report.creditNotesVat)],
    ["Net VAT payable", toDbNumeric(report.netVatPayable)],
  ];
  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vat-report-${params.start}-to-${params.end}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
