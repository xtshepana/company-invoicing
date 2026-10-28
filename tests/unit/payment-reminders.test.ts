import { beforeEach, describe, expect, it, vi } from "vitest";

// The reminder calendar: last day of the month and the 5th email each customer; the 7th sends the owner ONE list.
// These run the real service with the database and the mailer replaced.
vi.mock("server-only", () => ({}));
const recordAuditLog = vi.fn();
vi.mock("@/server/services/audit", () => ({ recordAuditLog: (entry: unknown) => recordAuditLog(entry) }));

type Sent = { to: string; subject: string; html: string; emailType: string; cc?: string | null; entityId?: string; fromName?: string };
let outcome: (params: Sent) => { status: "sent" | "failed" | "skipped"; error?: string } | Promise<never>;
const sendEmail = vi.fn(async (params: Sent) => outcome(params));
vi.mock("@/server/services/email", () => ({ sendEmail: (params: Sent) => sendEmail(params) }));

interface InvoiceRow {
  id: string;
  invoice_number: string;
  due_date: string;
  balance_due: number | null;
  customer_id: string;
  customers: { email: string; company_name: string; customer_reference: string | null } | null;
}
const state = {
  invoices: [] as InvoiceRow[],
  queries: [] as [string, ...unknown[]][],
  flags: new Set<string>(),
  deletes: [] as { ids: string[]; checkpoint: string; period: string }[],
};

function invoiceQuery() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  for (const method of ["gt", "not", "lte", "order"]) {
    builder[method] = (...args: unknown[]) => {
      state.queries.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: state.invoices, error: null });
  return builder;
}

const admin = {
  from: (table: string) => {
    if (table === "invoices") return invoiceQuery();
    return {
      // unique (invoice_id, checkpoint, period_month): a repeat is a unique violation, like Postgres
      insert: async (row: { invoice_id: string; checkpoint: string; period_month: string }) => {
        const key = `${row.invoice_id}|${row.checkpoint}|${row.period_month}`;
        if (state.flags.has(key)) return { error: { code: "23505" } };
        state.flags.add(key);
        return { error: null };
      },
      delete: () => ({
        in: (_column: string, ids: string[]) => ({
          eq: (_c1: string, checkpoint: string) => ({
            eq: async (_c2: string, period: string) => {
              state.deletes.push({ ids, checkpoint, period });
              for (const id of ids) state.flags.delete(`${id}|${checkpoint}|${period}`);
              return { error: null };
            },
          }),
        }),
      }),
    };
  },
};

import { runPaymentReminders } from "@/server/services/payment-reminders";
import type { CompanySettings } from "@/lib/config/system-settings";

const settings = {
  company_name: "Acme",
  default_currency: "ZAR",
  logo_url: null,
  phone: "0110000000",
  email: "info@acme.example",
  website: "",
  address_physical: "",
  registration_number: "",
  vat_number: "",
  brand_color: null,
  bank_name: "Test Bank",
  bank_account_name: "Acme Trading",
  bank_account_number: "1234567890",
  bank_branch_code: "250655",
  bank_account_type: "Cheque",
  accounts_notification_email: "accounts@acme.example",
  reminder_review_email: "owner@acme.example",
} as unknown as CompanySettings;

function invoice(n: number, customer: number, balance = 100, over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: `inv-${n}`,
    invoice_number: `INV-${String(n).padStart(6, "0")}`,
    due_date: "2026-10-31",
    balance_due: balance,
    customer_id: `cust-${customer}`,
    customers: { email: `c${customer}@x.co.za`, company_name: `Customer ${customer}`, customer_reference: `CUS00${customer}` },
    ...over,
  };
}

const sentOfType = (type: string) => sendEmail.mock.calls.map(([p]) => p).filter((p) => p.emailType === type);

beforeEach(() => {
  state.invoices = [];
  state.queries = [];
  state.flags = new Set();
  state.deletes = [];
  recordAuditLog.mockReset();
  sendEmail.mockClear();
  outcome = () => ({ status: "sent" });
});

describe("a day with no reminder", () => {
  it("does nothing, and does not even look at the invoices", async () => {
    state.invoices = [invoice(1, 1)];
    const result = await runPaymentReminders(admin as never, settings, "2026-11-04");

    expect(result.stage).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.queries).toEqual([]);
  });
});

describe("reminder 1 - the last day of the month", () => {
  const today = "2026-10-31";

  it("emails each customer ONE reminder listing all of their unpaid invoices, copies accounts, and sends the owner a summary", async () => {
    state.invoices = [invoice(1, 1, 500), invoice(2, 1, 250), invoice(3, 2, 99)];
    const result = await runPaymentReminders(admin as never, settings, today);

    const reminders = sentOfType("payment_reminder_1");
    expect(reminders).toHaveLength(2);
    const first = reminders.find((r) => r.to === "c1@x.co.za")!;
    expect(first.cc).toBe("accounts@acme.example");
    expect(first.fromName).toBe("Acme");
    expect(first.subject).toBe("Payment reminder from Acme: 2 unpaid invoices");
    expect(first.html).toContain("INV-000001");
    expect(first.html).toContain("INV-000002");
    expect(first.html).not.toContain("INV-000003"); // another customer's invoice never appears
    expect(first.html).toContain("CUS001"); // their account number as the payment reference
    expect(first.html).toContain("Account number: 1234567890"); // where to pay
    expect(first.html.match(/Kind regards/g)).toHaveLength(1);
    expect(reminders.find((r) => r.to === "c2@x.co.za")!.subject).toBe("Payment reminder from Acme: invoice INV-000003 is due");

    const summary = sentOfType("payment_reminder_summary");
    expect(summary).toHaveLength(1);
    expect(summary[0].to).toBe("owner@acme.example");
    expect(summary[0].subject).toBe("Reminder 1 (last day of the month): 2 customers emailed");
    expect(summary[0].html).toContain("Customer 1");
    expect(summary[0].html).toContain("Customer 2");

    expect(result).toMatchObject({ stage: "reminder_1", overdueInvoices: 3, newlyFlagged: 3, customersEmailed: 2, customersNotEmailed: 0, summarySent: true });
    expect([...state.flags].sort()).toEqual(["inv-1|reminder_1|2026-10-01", "inv-2|reminder_1|2026-10-01", "inv-3|reminder_1|2026-10-01"]);
    expect(recordAuditLog).toHaveBeenCalledTimes(3);
  });

  it("only looks at unpaid, issued invoices that are past due - never drafts, cancelled or void", async () => {
    state.invoices = [invoice(1, 1)];
    await runPaymentReminders(admin as never, settings, today);

    expect(state.queries).toContainEqual(["gt", "balance_due", 0]);
    expect(state.queries).toContainEqual(["not", "status", "in", "(draft,cancelled,void)"]);
    expect(state.queries).toContainEqual(["lte", "due_date", today]);
  });

  it("sends nothing the second time the job runs the same day", async () => {
    state.invoices = [invoice(1, 1)];
    await runPaymentReminders(admin as never, settings, today);
    sendEmail.mockClear();
    const again = await runPaymentReminders(admin as never, settings, today);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(again).toMatchObject({ newlyFlagged: 0, customersEmailed: 0 });
  });

  it("reports a customer with no single valid email address to the owner instead of dropping them", async () => {
    state.invoices = [
      invoice(1, 1, 100, { customers: { email: "", company_name: "No Email Ltd", customer_reference: "NOE001" } }),
      invoice(2, 2, 100, { customers: { email: "a@x.co.za; b@x.co.za", company_name: "Two Emails Ltd", customer_reference: "TWO001" } }),
      invoice(3, 3),
    ];
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(sentOfType("payment_reminder_1").map((r) => r.to)).toEqual(["c3@x.co.za"]);
    expect(result).toMatchObject({ customersEmailed: 1, customersNotEmailed: 2 });
    const summary = sentOfType("payment_reminder_summary")[0];
    expect(summary.subject).toContain("2 could not be");
    expect(summary.html).toContain("No Email Ltd");
    expect(summary.html).toContain("Two Emails Ltd");
    expect(summary.html).toContain("no single valid email address");
  });

  it("takes the record back when an email fails, tells the owner, and retries on the next run", async () => {
    state.invoices = [invoice(1, 1), invoice(2, 2)];
    outcome = (p) => (p.to === "c1@x.co.za" ? { status: "failed", error: "Mailbox full" } : { status: "sent" });
    const first = await runPaymentReminders(admin as never, settings, today);

    expect(first).toMatchObject({ customersEmailed: 1, customersNotEmailed: 1 });
    expect(first.errors.join(" ")).toMatch(/Customer 1.*Mailbox full/);
    expect(state.deletes).toEqual([{ ids: ["inv-1"], checkpoint: "reminder_1", period: "2026-10-01" }]);
    expect(state.flags.has("inv-1|reminder_1|2026-10-01")).toBe(false); // not recorded as done
    expect(state.flags.has("inv-2|reminder_1|2026-10-01")).toBe(true);
    expect(sentOfType("payment_reminder_summary")[0].html).toContain("Mailbox full");

    outcome = () => ({ status: "sent" });
    sendEmail.mockClear();
    const retry = await runPaymentReminders(admin as never, settings, today);

    expect(sentOfType("payment_reminder_1").map((r) => r.to)).toEqual(["c1@x.co.za"]); // only the one that failed
    expect(retry.customersEmailed).toBe(1);
  });

  it("treats 'email sending isn't set up' as not sent, and a throwing send as failed", async () => {
    state.invoices = [invoice(1, 1), invoice(2, 2)];
    outcome = (p) => (p.to === "c1@x.co.za" ? { status: "skipped" } : Promise.reject(new Error("socket hang up")));
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(result.customersEmailed).toBe(0);
    expect(result.customersNotEmailed).toBe(2);
    expect(result.errors.join(" ")).toMatch(/isn't set up/);
    expect(result.errors.join(" ")).toMatch(/socket hang up/);
    expect(state.flags.size).toBe(0);
  });

  it("still reminds customers when there is no owner address, just without the summary", async () => {
    state.invoices = [invoice(1, 1)];
    const result = await runPaymentReminders(admin as never, { ...settings, reminder_review_email: null } as CompanySettings, today);

    expect(sentOfType("payment_reminder_1")).toHaveLength(1);
    expect(sentOfType("payment_reminder_summary")).toHaveLength(0);
    expect(result.summarySent).toBe(false);
  });

  it("does nothing when nothing is overdue", async () => {
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result).toMatchObject({ overdueInvoices: 0, newlyFlagged: 0 });
  });
});

describe("reminder 2 - the 5th, the final reminder", () => {
  it("emails the final reminder, tracked separately from reminder 1", async () => {
    state.invoices = [invoice(1, 1, 570, { due_date: "2026-10-31" })];
    state.flags.add("inv-1|reminder_1|2026-10-01"); // already got reminder 1 last month
    const result = await runPaymentReminders(admin as never, settings, "2026-11-05");

    const [reminder] = sentOfType("payment_reminder_2");
    expect(reminder.to).toBe("c1@x.co.za");
    expect(reminder.subject).toBe("Final reminder from Acme: payment outstanding");
    expect(reminder.html).toContain("final reminder");
    expect(reminder.html).toContain("If you have already paid");
    expect(state.flags.has("inv-1|reminder_2|2026-11-01")).toBe(true);
    expect(sentOfType("payment_reminder_summary")[0].subject).toBe("Final reminder (the 5th): 1 customer emailed");
    expect(result.stage).toBe("reminder_2");
  });
});

describe("the 7th - one list of accounts to block", () => {
  const today = "2026-11-07";

  it("sends the owner ONE email listing every unpaid account, and nothing to any customer", async () => {
    state.invoices = [invoice(1, 1, 500), invoice(2, 1, 250), invoice(3, 2, 99, { due_date: "2026-09-30" })];
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [list] = sentOfType("account_blocking_list");
    expect(list.to).toBe("owner@acme.example");
    expect(list.subject).toMatch(/^Accounts to block: 2 unpaid \(R\s849,00\)$/); // South African formatting puts a non-breaking space after the R
    expect(list.html).toContain("Customer 1");
    expect(list.html).toContain("Customer 2");
    expect(list.html).toContain("INV-000001, INV-000002"); // one row per customer, with all their invoices
    expect(list.html).toContain("CUS001");
    expect(list.html).toContain("c1@x.co.za");
    expect(list.html).toContain("review");
    expect(result).toMatchObject({ stage: "block_list", blockingListSent: true, newlyFlagged: 3, customersEmailed: 0 });
    expect(state.flags.has("inv-1|block_list|2026-11-01")).toBe(true);
    expect(recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "invoice.flagged_for_blocking", entityId: "inv-3" }));
  });

  it("does not send the list twice in a month", async () => {
    state.invoices = [invoice(1, 1)];
    await runPaymentReminders(admin as never, settings, today);
    sendEmail.mockClear();
    const again = await runPaymentReminders(admin as never, settings, today);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(again.blockingListSent).toBe(false);
  });

  it("falls back to the accounts mailbox when there is no review address", async () => {
    state.invoices = [invoice(1, 1)];
    await runPaymentReminders(admin as never, { ...settings, reminder_review_email: "" } as CompanySettings, today);

    expect(sentOfType("account_blocking_list")[0].to).toBe("accounts@acme.example");
  });

  it("does not record anything when there is nowhere to send it, so it can still go out later", async () => {
    state.invoices = [invoice(1, 1)];
    const result = await runPaymentReminders(admin as never, { ...settings, reminder_review_email: null, accounts_notification_email: null } as CompanySettings, today);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(state.flags.size).toBe(0);
    expect(result.errors[0]).toMatch(/was not sent/);
  });

  it("takes the records back when the list fails to send, so it is retried", async () => {
    state.invoices = [invoice(1, 1), invoice(2, 2)];
    outcome = () => ({ status: "failed", error: "Resend down" });
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(result.blockingListSent).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Resend down/);
    expect(state.flags.size).toBe(0);
  });

  it("does not list an account that has paid up", async () => {
    state.invoices = []; // the query only returns invoices still owing
    const result = await runPaymentReminders(admin as never, settings, today);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.blockingListSent).toBe(false);
  });
});

