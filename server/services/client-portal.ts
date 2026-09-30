import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/server/services/audit";
import { assertOwnsCustomer, type ClientSession } from "@/server/services/client-auth";
import type { Tables } from "@/types/database";

export type ClientQuoteWithItems = Tables<"quotes"> & {
  customers: { company_name: string } | null;
  quote_items: Tables<"quote_items">[];
};
export type ClientInvoiceWithItems = Tables<"invoices"> & {
  customers: { company_name: string } | null;
  invoice_items: Tables<"invoice_items">[];
};

/** Quotes across every customer this session can see. Drafts are excluded - never sent to the customer, so never shown here either. */
export async function listClientQuotes(session: ClientSession) {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("quotes")
    .select("id, quote_number, quote_date, expiry_date, status, total")
    .in("customer_id", session.customerIds)
    .neq("status", "draft")
    .order("quote_date", { ascending: false });
  return data ?? [];
}

/** Same as listClientQuotes, for invoices. */
export async function listClientInvoices(session: ClientSession) {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("invoices")
    .select("id, invoice_number, invoice_date, due_date, status, total, balance_due")
    .in("customer_id", session.customerIds)
    .neq("status", "draft")
    .order("invoice_date", { ascending: false });
  return data ?? [];
}

/**
 * A missing row, a draft, and a row owned by a different customer all
 * return null here rather than distinguishing why - this is what keeps
 * the quote/invoice detail pages from ever revealing (via a 403 vs. a
 * 404) that some other company's document exists at a guessed id.
 */
export async function getClientQuoteById(session: ClientSession, quoteId: string): Promise<ClientQuoteWithItems | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("quotes")
    .select("*, customers(company_name), quote_items(*)")
    .eq("id", quoteId)
    .order("sort_order", { referencedTable: "quote_items", ascending: true })
    .maybeSingle();
  if (!data || data.status === "draft") return null;
  try {
    assertOwnsCustomer(session, data.customer_id);
  } catch {
    return null;
  }
  return data as ClientQuoteWithItems;
}

export async function getClientInvoiceById(
  session: ClientSession,
  invoiceId: string
): Promise<ClientInvoiceWithItems | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("invoices")
    .select("*, customers(company_name), invoice_items(*)")
    .eq("id", invoiceId)
    .order("sort_order", { referencedTable: "invoice_items", ascending: true })
    .maybeSingle();
  if (!data || data.status === "draft") return null;
  try {
    assertOwnsCustomer(session, data.customer_id);
  } catch {
    return null;
  }
  return data as ClientInvoiceWithItems;
}

/**
 * The only write the client portal allows. Only a 'sent', unexpired quote
 * can be responded to; the update's own `.eq("status", "sent")` closes the
 * same race a second concurrent click could otherwise open (both tabs
 * reading "sent" before either writes).
 */
export async function respondToClientQuote(
  session: ClientSession,
  quoteId: string,
  decision: "accepted" | "rejected"
): Promise<{ error?: string }> {
  const admin = createAdminSupabaseClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("id, customer_id, status, expiry_date")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found." };

  try {
    assertOwnsCustomer(session, quote.customer_id);
  } catch {
    return { error: "Quote not found." };
  }

  if (quote.status !== "sent") {
    return { error: "This quote has already been responded to or is no longer open." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (quote.expiry_date && quote.expiry_date < today) {
    return { error: "This quote has expired." };
  }

  const { error, data: updated } = await admin
    .from("quotes")
    .update({ status: decision })
    .eq("id", quoteId)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { error: "This quote has already been responded to or is no longer open." };
  }

  await recordAuditLog({
    userId: null,
    action: decision === "accepted" ? "quote.accepted_by_client" : "quote.rejected_by_client",
    entity: "quotes",
    entityId: quoteId,
    newValue: { actor: "client", customer_id: quote.customer_id },
  });

  return {};
}
