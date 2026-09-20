import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Every business-data table, in an order that's safe to restore into (a
 * hand-rolled restore script would still need to insert parents before
 * children — this list is already topologically sorted for that: company
 * settings and profiles first, then documents, then the ledgers/join
 * tables that reference them, then logs last).
 */
const EXPORT_TABLES = [
  "company_settings",
  "profiles",
  "customers",
  "products",
  "quotes",
  "quote_items",
  "invoices",
  "invoice_items",
  "recurring_invoices",
  "recurring_invoice_items",
  "credit_notes",
  "credit_note_items",
  "payments",
  "payment_allocations",
  "customer_credits",
  "bank_import_batches",
  "bank_transactions",
  "invoice_reminders_sent",
  "email_logs",
  "audit_logs",
] as const;

export interface FullDataExport {
  exportedAt: string;
  tables: Record<(typeof EXPORT_TABLES)[number], unknown[]>;
}

/**
 * Full-database export for disaster recovery — uses the service-role
 * client since it must bypass RLS entirely (this is the one legitimate
 * reason to read every row of every table regardless of module
 * permissions; the route calling this already gated the caller to
 * owner_admin before it gets here). No restore path exists yet — this is
 * export-only, matched to what was actually asked for.
 */
export async function getFullDataExport(): Promise<FullDataExport> {
  const admin = createAdminSupabaseClient();

  const tables = {} as FullDataExport["tables"];

  for (const table of EXPORT_TABLES) {
    const { data, error } = await admin.from(table).select("*");
    if (error) {
      throw new Error(`Failed to export table "${table}": ${error.message}`);
    }
    tables[table] = data ?? [];
  }

  return { exportedAt: new Date().toISOString(), tables };
}
