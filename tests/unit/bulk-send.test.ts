import { beforeEach, describe, expect, it, vi } from "vitest";
import { BULK_SEND_BATCH_SIZE, chunk, splitSendable, summarizeBulkSend, type BulkSendResult } from "@/lib/bulk-send";

describe("chunk", () => {
  it("splits a list into batches, keeping the order and the remainder", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(chunk([], 5)).toEqual([]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("rejects a batch size below 1 instead of looping forever", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("splitSendable / summarizeBulkSend", () => {
  const draft = (id: string, email: string | null) => ({ id, invoice_number: `INV-${id}`, customer_name: `Customer ${id}`, email, total: 100 });

  it("separates drafts that can be emailed from those without a valid address", () => {
    const { sendable, blocked } = splitSendable([draft("1", "a@x.co.za"), draft("2", null), draft("3", "c@x.co.za")]);
    expect(sendable.map((d) => d.id)).toEqual(["1", "3"]);
    expect(blocked.map((d) => d.id)).toEqual(["2"]);
  });

  it("counts each outcome and lists everything that was not sent", () => {
    const r = (status: BulkSendResult["status"], n: number): BulkSendResult => ({ invoiceId: `${n}`, invoiceNumber: `INV-${n}`, customerName: "C", status });
    const summary = summarizeBulkSend([r("sent", 1), r("sent", 2), r("failed", 3), r("skipped", 4), r("no_email", 5)]);
    expect(summary).toMatchObject({ sent: 2, failed: 1, skipped: 1, noEmail: 1 });
    expect(summary.problems.map((p) => p.invoiceId)).toEqual(["3", "4", "5"]);
  });
});

// ---- the server action, with the database, mailer and PDF renderer replaced ----
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
const requireModuleAccess = vi.fn();
vi.mock("@/server/services/auth", () => ({ requireModuleAccess: (module: string) => requireModuleAccess(module) }));
const recordAuditLog = vi.fn();
vi.mock("@/server/services/audit", () => ({ recordAuditLog: (entry: unknown) => recordAuditLog(entry) }));
vi.mock("@/lib/config/system-settings", () => ({
  getCompanySettings: async () => ({
    company_name: "Acme",
    logo_url: null,
    phone: "0110000000",
    email: "info@acme.example",
    website: "",
    address_physical: "",
    registration_number: "",
    vat_number: "",
    brand_color: null,
    accounts_notification_email: "accounts@acme.example",
  }),
}));
vi.mock("@/lib/pdf/render-invoice", () => ({ renderInvoicePdf: async () => Buffer.from("pdf") }));

type Sent = { to: string; entityId?: string; cc?: string | null };
let emailOutcome: (id: string) => { status: "sent" | "failed" | "skipped"; error?: string } | Promise<never>;
const sendEmail = vi.fn(async (params: Sent) => emailOutcome(params.entityId ?? ""));
vi.mock("@/server/services/email", () => ({ sendEmail: (params: Sent) => sendEmail(params) }));

// One in-memory table of invoices stands in for Supabase for both the user's client and the admin client.
interface Row {
  id: string;
  invoice_number: string;
  status: string;
  customers: { company_name: string; email: string } | null;
}
const db = { invoices: new Map<string, Row>(), claimConflicts: new Set<string>(), claimError: false, statusWrites: [] as [string, string][] };

function userClient() {
  return {
    from: () => ({
      select: () => ({
        in: async (_column: string, ids: string[]) => ({ data: ids.map((id) => db.invoices.get(id)).filter(Boolean), error: null }),
      }),
      update: (values: { status: string }) => ({
        eq: (_c1: string, id: string) => ({
          eq: (_c2: string, from: string) => {
            const apply = () => {
              const row = db.invoices.get(id);
              if (!row || row.status !== from || db.claimConflicts.has(id)) return [];
              row.status = values.status;
              db.statusWrites.push([id, values.status]);
              return [{ id }];
            };
            // the claim chains .select("id"); the revert is awaited directly
            const result = { error: null as unknown, data: null as unknown };
            return Object.assign(Promise.resolve().then(() => (db.claimError ? { error: { message: "boom" }, data: null } : { error: null, data: apply() })), {
              select: async () => (db.claimError ? { data: null, error: { message: "boom" } } : { data: apply(), error: null }),
              ...result,
            });
          },
        }),
      }),
    }),
  };
}
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => userClient() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          single: async () => {
            const row = db.invoices.get(id);
            return { data: row ? { ...row, total: 100, invoice_items: [] } : null, error: null };
          },
        }),
      }),
    }),
  }),
}));

import { sendDraftInvoiceBatchAction } from "@/server/actions/invoice-actions";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function add(n: number, over: Partial<Row> = {}) {
  db.invoices.set(ID(n), { id: ID(n), invoice_number: `INV-${String(n).padStart(6, "0")}`, status: "draft", customers: { company_name: `Customer ${n}`, email: `c${n}@x.co.za` }, ...over });
}

beforeEach(() => {
  db.invoices.clear();
  db.claimConflicts.clear();
  db.claimError = false;
  db.statusWrites = [];
  revalidatePath.mockReset();
  recordAuditLog.mockReset();
  sendEmail.mockClear();
  requireModuleAccess.mockReset().mockResolvedValue({ id: "user-1" });
  emailOutcome = () => ({ status: "sent" });
});

describe("sendDraftInvoiceBatchAction", () => {
  it("emails each draft, marks it Sent, records it, and copies the accounts mailbox", async () => {
    add(1);
    add(2);
    const { results, error } = await sendDraftInvoiceBatchAction([ID(1), ID(2)]);

    expect(error).toBeUndefined();
    expect(results.map((r) => r.status)).toEqual(["sent", "sent"]);
    expect(db.invoices.get(ID(1))?.status).toBe("sent");
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map(([p]) => [p.to, p.cc])).toEqual([
      ["c1@x.co.za", "accounts@acme.example"],
      ["c2@x.co.za", "accounts@acme.example"],
    ]);
    expect(recordAuditLog).toHaveBeenCalledTimes(2);
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", action: "invoice.marked_sent", newValue: { emailed: true, bulk: true } }));
    expect(requireModuleAccess).toHaveBeenCalledWith("invoices");
    expect(revalidatePath).toHaveBeenCalledWith("/invoices");
  });

  it("puts an invoice back to Draft when its email fails, and reports why", async () => {
    add(1);
    add(2);
    emailOutcome = (id) => (id === ID(1) ? { status: "failed", error: "Mailbox full" } : { status: "sent" });
    const { results } = await sendDraftInvoiceBatchAction([ID(1), ID(2)]);

    expect(results.find((r) => r.invoiceId === ID(1))).toMatchObject({ status: "failed" });
    expect(results.find((r) => r.invoiceId === ID(1))?.detail).toMatch(/Mailbox full.*still a draft/);
    expect(db.invoices.get(ID(1))?.status).toBe("draft"); // reverted
    expect(db.invoices.get(ID(2))?.status).toBe("sent");
    expect(recordAuditLog).toHaveBeenCalledTimes(1); // only the one that really went out
  });

  it("treats 'email sending isn't set up' as not sent, not as sent", async () => {
    add(1);
    emailOutcome = () => ({ status: "skipped" });
    const { results } = await sendDraftInvoiceBatchAction([ID(1)]);

    expect(results[0].status).toBe("failed");
    expect(results[0].detail).toMatch(/isn't set up/);
    expect(db.invoices.get(ID(1))?.status).toBe("draft");
  });

  it("puts the invoice back when sending throws", async () => {
    add(1);
    emailOutcome = () => Promise.reject(new Error("render crashed"));
    const { results } = await sendDraftInvoiceBatchAction([ID(1)]);

    expect(results[0]).toMatchObject({ status: "failed" });
    expect(results[0].detail).toMatch(/render crashed/);
    expect(db.invoices.get(ID(1))?.status).toBe("draft");
  });

  it("never emails an invoice that is no longer a draft - so a double click cannot send twice", async () => {
    add(1);
    const first = await sendDraftInvoiceBatchAction([ID(1)]);
    const second = await sendDraftInvoiceBatchAction([ID(1)]);

    expect(first.results[0].status).toBe("sent");
    expect(second.results[0]).toMatchObject({ status: "skipped", detail: "Already sent." });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("leaves paid, cancelled and partially paid invoices alone", async () => {
    add(1, { status: "paid" });
    add(2, { status: "cancelled" });
    add(3, { status: "partially_paid" });
    const { results } = await sendDraftInvoiceBatchAction([ID(1), ID(2), ID(3)]);

    expect(results.every((r) => r.status === "skipped")).toBe(true);
    expect(results.map((r) => r.detail)).toEqual(["Already paid.", "Already cancelled.", "Already partially paid."]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.statusWrites).toEqual([]);
  });

  it("skips a customer without one valid email address and changes nothing", async () => {
    add(1, { customers: { company_name: "No Email", email: "" } });
    add(2, { customers: { company_name: "Two", email: "a@x.co.za; b@x.co.za" } });
    const { results } = await sendDraftInvoiceBatchAction([ID(1), ID(2)]);

    expect(results.map((r) => r.status)).toEqual(["no_email", "no_email"]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.statusWrites).toEqual([]);
  });

  it("does not email when someone else changed the invoice between loading and claiming it", async () => {
    add(1);
    db.claimConflicts.add(ID(1));
    const { results } = await sendDraftInvoiceBatchAction([ID(1)]);

    expect(results[0]).toMatchObject({ status: "skipped", detail: "Changed by someone else just now." });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports an invoice that does not exist", async () => {
    const { results } = await sendDraftInvoiceBatchAction([ID(99)]);
    expect(results[0]).toMatchObject({ status: "skipped", detail: "Invoice not found." });
  });

  it("refuses an empty list, an oversized batch and malformed ids", async () => {
    expect((await sendDraftInvoiceBatchAction([])).error).toMatch(/no invoices/i);
    const tooMany = Array.from({ length: BULK_SEND_BATCH_SIZE + 1 }, (_, i) => ID(i + 1));
    expect((await sendDraftInvoiceBatchAction(tooMany)).error).toMatch(/at most/i);
    expect((await sendDraftInvoiceBatchAction(["not-a-uuid"])).error).toMatch(/invalid/i);
    expect((await sendDraftInvoiceBatchAction(null as unknown as string[])).error).toBeTruthy();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a repeated id only once", async () => {
    add(1);
    const { results } = await sendDraftInvoiceBatchAction([ID(1), ID(1)]);

    expect(results).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("stops before touching anything when the caller lacks invoices access", async () => {
    add(1);
    requireModuleAccess.mockRejectedValue(new Error("forbidden"));

    await expect(sendDraftInvoiceBatchAction([ID(1)])).rejects.toThrow("forbidden");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.invoices.get(ID(1))?.status).toBe("draft");
  });

  it("reports a failure to claim the invoice without emailing it", async () => {
    add(1);
    db.claimError = true;
    const { results } = await sendDraftInvoiceBatchAction([ID(1)]);

    expect(results[0]).toMatchObject({ status: "failed" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
