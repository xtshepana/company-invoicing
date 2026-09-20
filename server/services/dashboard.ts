import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface RecentActivityItem {
  id: string;
  action: string;
  entity: string;
  actorName: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  activeStaffCount: number;
  recentActivity: RecentActivityItem[];
}

/**
 * Phase 1 dashboard data. Sales/payments/overdue/banking metrics are added
 * once their tables exist (Phases 3-7) — this intentionally does not show
 * placeholder numbers for data that doesn't exist yet.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createSupabaseServerClient();

  const [{ count: activeStaffCount }, { data: activityRows }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("audit_logs")
      .select("id, action, entity, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const recentActivity: RecentActivityItem[] = (activityRows ?? []).map((row) => {
    const actor = row.profiles as { full_name: string; email: string } | null;
    return {
      id: row.id,
      action: row.action,
      entity: row.entity,
      actorName: actor ? actor.full_name || actor.email : null,
      createdAt: row.created_at,
    };
  });

  return {
    activeStaffCount: activeStaffCount ?? 0,
    recentActivity,
  };
}
