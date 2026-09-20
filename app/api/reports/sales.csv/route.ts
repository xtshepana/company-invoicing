import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getSalesReport } from "@/server/services/reports";
import { salesReportSearchSchema } from "@/lib/validations/reports";
import { toDbNumeric } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");
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
  const params = salesReportSearchSchema.parse(Object.fromEntries(searchParams));
  const report = await getSalesReport(params.start, params.end);

  const invoiceSection = [
    ["Invoices"],
    ["Date", "Invoice", "Customer", "Excl. VAT", "VAT", "Total"],
    ...report.invoices.map((row) => [
      row.date,
      row.invoiceNumber,
      row.customerName,
      toDbNumeric(row.subtotal),
      toDbNumeric(row.vatTotal),
      toDbNumeric(row.total),
    ]),
    ["Total", "", "", toDbNumeric(report.invoicedExclVat), "", toDbNumeric(report.invoicedInclVat)],
  ];

  const paymentSection = [
    [],
    ["Payments received"],
    ["Date", "Customer", "Method", "Reference", "Amount"],
    ...report.payments.map((row) => [
      row.date,
      row.customerName,
      PAYMENT_METHOD_LABELS[row.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? row.paymentMethod,
      row.bankReference,
      toDbNumeric(row.amount),
    ]),
    ["Total", "", "", "", toDbNumeric(report.paymentsReceived)],
  ];

  const csv = toCsv([...invoiceSection, ...paymentSection] as (string | number)[][]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-report-${params.start}-to-${params.end}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
