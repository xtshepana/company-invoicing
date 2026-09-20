import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getAgingReport } from "@/server/services/reports";
import { agingReportSearchSchema } from "@/lib/validations/reports";
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
  const params = agingReportSearchSchema.parse(Object.fromEntries(searchParams));
  const report = await getAgingReport(params.asOf);

  const rows = [
    ["Customer", "Current", "1-30 days", "31-60 days", "61-90 days", "90+ days", "Total"],
    ...report.rows.map((row) => [
      row.customerName,
      toDbNumeric(row.current),
      toDbNumeric(row.days1to30),
      toDbNumeric(row.days31to60),
      toDbNumeric(row.days61to90),
      toDbNumeric(row.days90plus),
      toDbNumeric(row.total),
    ]),
    [
      "Total",
      toDbNumeric(report.totals.current),
      toDbNumeric(report.totals.days1to30),
      toDbNumeric(report.totals.days31to60),
      toDbNumeric(report.totals.days61to90),
      toDbNumeric(report.totals.days90plus),
      toDbNumeric(report.totals.total),
    ],
  ];
  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aging-report-${params.asOf}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
