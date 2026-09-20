import { NextResponse } from "next/server";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerStatement } from "@/server/services/statements";
import { toDbNumeric } from "@/lib/money";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

  const rows = [
    ["Date", "Reference", "Description", "Debit", "Credit", "Balance"],
    ...statement.lines.map((line) => [
      line.date ?? "",
      line.reference,
      line.description,
      line.debit > 0 ? toDbNumeric(line.debit) : "",
      line.credit > 0 ? toDbNumeric(line.credit) : "",
      toDbNumeric(line.balance),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");

  const filename = `${statement.customer.company_name.replace(/[^a-z0-9]+/gi, "-")}-statement.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
