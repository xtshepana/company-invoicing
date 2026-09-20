import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

export interface AuditLogRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  rows: AuditLogRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Server-side paginated read — never load the full audit log into the browser at once. */
export async function getAuditLogPage(page: number): Promise<AuditLogPage> {
  const supabase = await createSupabaseServerClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await supabase
    .from("audit_logs")
    .select("id, action, entity, entity_id, created_at, profiles(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows: AuditLogRow[] = (data ?? []).map((row) => {
    const actor = row.profiles as { full_name: string; email: string } | null;
    return {
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      actorName: actor ? actor.full_name || actor.email : "System",
      createdAt: row.created_at,
    };
  });

  return { rows, page: safePage, pageSize: PAGE_SIZE, totalCount: count ?? 0 };
}
