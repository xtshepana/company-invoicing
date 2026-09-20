import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export interface AuditLogEntry {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: Json | null;
  newValue?: Json | null;
}

/**
 * Writes an audit log row via the service-role client. This is the only
 * code path that ever inserts into audit_logs — there is no RLS insert
 * policy for the authenticated role, by design (see 0002_rls.sql), so
 * application code cannot forge or tamper with entries any other way.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("audit_logs").insert({
    user_id: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
  });

  if (error) {
    console.error("Failed to write audit log", { entity: entry.entity, action: entry.action, error });
  }
}
