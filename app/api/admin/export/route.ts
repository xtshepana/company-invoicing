import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/server/services/auth";
import { recordAuditLog } from "@/server/services/audit";
import { getFullDataExport } from "@/server/services/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Full-database JSON export for disaster recovery — owner_admin only.
 * /api/* is excluded from proxy.ts's matcher, so this route verifies the
 * caller itself, same as the PDF/CSV export routes.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (profile.role !== "owner_admin") {
    return NextResponse.json({ error: "This action requires administrator access." }, { status: 403 });
  }

  const data = await getFullDataExport();

  await recordAuditLog({
    userId: profile.id,
    action: "backup.exported",
    entity: "database",
    newValue: { table_count: Object.keys(data.tables).length },
  });

  const filename = `company-invoicing-backup-${data.exportedAt.slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
