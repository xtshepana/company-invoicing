import { describe, expect, it } from "vitest";
import { accountBlockingListEmail, customerPaymentReminderEmail, reminderSummaryEmail } from "@/lib/email/templates";
import { emailSignatureFromSettings } from "@/lib/email/signature";

const signature = emailSignatureFromSettings({
  company_name: "Acme",
  logo_url: null,
  phone: "0110000000",
  email: "info@acme.example",
  website: "",
  address_physical: "",
  registration_number: "",
  vat_number: "",
  brand_color: null,
});

const invoice = (n: number, balanceDue = 570) => ({ invoiceNumber: `INV-00000${n}`, dueDate: "2026-10-31", balanceDue });
const base = { companyName: "Acme", customerName: "Customer One", accountNumber: "CUS001", currency: "ZAR", stage: "reminder_1" as const };

describe("customerPaymentReminderEmail", () => {
  it("reminds about one invoice with the account number as the payment reference", () => {
    const email = customerPaymentReminderEmail({ ...base, invoices: [invoice(1)] });

    expect(email.subject).toBe("Payment reminder from Acme: invoice INV-000001 is due");
    expect(email.html).toContain("Dear Customer One,");
    expect(email.html).toContain("now due");
    expect(email.html).toContain("INV-000001");
    expect(email.html).toMatch(/31\/10\/2026|2026\/10\/31|31 Oct/); // the due date, however en-ZA writes it
    expect(email.html).toContain("CUS001");
    expect(email.html).toContain("payment reference");
    expect(email.html).toContain("If you have already paid");
    expect(email.html).not.toContain("final reminder");
  });

  it("lists several invoices with a total", () => {
    const email = customerPaymentReminderEmail({ ...base, invoices: [invoice(1, 500), invoice(2, 250)] });

    expect(email.subject).toBe("Payment reminder from Acme: 2 unpaid invoices");
    expect(email.html).toContain("INV-000001");
    expect(email.html).toContain("INV-000002");
    expect(email.html).toContain("Total");
    expect(email.html).toMatch(/R\s750,00/);
    expect(email.html).toContain("the invoices below are");
  });

  it("is firmer, but does not threaten any consequence, on the final reminder", () => {
    const email = customerPaymentReminderEmail({ ...base, stage: "reminder_2", invoices: [invoice(1)] });

    expect(email.subject).toBe("Final reminder from Acme: payment outstanding");
    expect(email.html).toContain("final reminder");
    expect(email.html).toContain("Please make payment today");
    expect(email.html).not.toMatch(/block|suspend|legal|cancel your/i);
  });

  it("shows where to pay only when the company has bank details", () => {
    const withBank = customerPaymentReminderEmail({ ...base, invoices: [invoice(1)], bankLines: ["Bank: Test Bank", "Account number: 1234567890"] });
    const withoutBank = customerPaymentReminderEmail({ ...base, invoices: [invoice(1)] });

    expect(withBank.html).toContain("Bank: Test Bank");
    expect(withBank.html).toContain("Account number: 1234567890");
    expect(withoutBank.html).not.toContain("Test Bank");
  });

  it("carries the company signature once, in place of a plain sign-off", () => {
    const email = customerPaymentReminderEmail({ ...base, invoices: [invoice(1)], signature });

    expect(email.html.match(/Kind regards/g)).toHaveLength(1);
    expect(email.html).toContain("0110000000");
  });

  it("escapes names, so a customer called <script> cannot inject markup", () => {
    const email = customerPaymentReminderEmail({ ...base, customerName: "<script>alert(1)</script>", accountNumber: "A&B", invoices: [invoice(1)] });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A&amp;B");
  });
});

describe("reminderSummaryEmail (the owner's copy)", () => {
  const row = (n: number, reason?: string) => ({ accountNumber: `CUS00${n}`, customerName: `Customer ${n}`, invoiceNumbers: [`INV-00000${n}`], total: 100 * n, reason });

  it("says who was emailed", () => {
    const email = reminderSummaryEmail({ companyName: "Acme", stage: "reminder_1", currency: "ZAR", emailed: [row(1), row(2)], notEmailed: [] });

    expect(email.subject).toBe("Reminder 1 (last day of the month): 2 customers emailed");
    expect(email.html).toContain("Customer 1");
    expect(email.html).toContain("Customer 2");
    expect(email.html).not.toContain("could not be emailed");
  });

  it("calls out, with the reason, everyone who could not be reached", () => {
    const email = reminderSummaryEmail({
      companyName: "Acme",
      stage: "reminder_2",
      currency: "ZAR",
      emailed: [row(1)],
      notEmailed: [row(2, "The customer has no single valid email address.")],
    });

    expect(email.subject).toBe("Final reminder (the 5th): 1 customer emailed, 1 could not be");
    expect(email.html).toContain("1 could not be emailed");
    expect(email.html).toContain("Customer 2");
    expect(email.html).toContain("no single valid email address");
  });

  it("handles the case where nobody could be emailed", () => {
    const email = reminderSummaryEmail({ companyName: "Acme", stage: "reminder_1", currency: "ZAR", emailed: [], notEmailed: [row(1, "x")] });

    expect(email.subject).toBe("Reminder 1 (last day of the month): 0 customers emailed, 1 could not be");
  });
});

describe("accountBlockingListEmail (the 7th)", () => {
  const item = (n: number, balance: number) => ({
    accountNumber: `CUS00${n}`,
    customerName: `Customer ${n}`,
    email: `c${n}@x.co.za`,
    invoices: [invoice(n, balance)],
    balance,
    oldestDueDate: "2026-10-31",
  });

  it("lists every account once with its invoices, oldest due date, balance and a grand total", () => {
    const email = accountBlockingListEmail({ companyName: "Acme", currency: "ZAR", items: [item(1, 570), item(2, 249)] });

    expect(email.subject).toMatch(/^Accounts to block: 2 unpaid \(R\s819,00\)$/);
    expect(email.html).toContain("CUS001");
    expect(email.html).toContain("Customer 2");
    expect(email.html).toContain("INV-000001");
    expect(email.html).toContain("c1@x.co.za");
    expect(email.html).toContain("Total unpaid");
    expect(email.html).toMatch(/R\s819,00/);
    expect(email.html).toContain("for blocking");
  });

  it("reads correctly for a single account", () => {
    const email = accountBlockingListEmail({ companyName: "Acme", currency: "ZAR", items: [item(1, 570)] });

    expect(email.html).toContain("account still has");
    expect(email.html).toContain("review it for blocking");
  });

  it("shows a missing email address plainly, and escapes names", () => {
    const email = accountBlockingListEmail({ companyName: "Acme", currency: "ZAR", items: [{ ...item(1, 570), customerName: "<b>Bold</b> Ltd", email: "" }] });

    expect(email.html).toContain("no email address");
    expect(email.html).not.toContain("<b>Bold</b>");
    expect(email.html).toContain("&lt;b&gt;Bold&lt;/b&gt;");
  });
});
