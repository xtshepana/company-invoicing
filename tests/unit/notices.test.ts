import { describe, it, expect } from "vitest";
import {
  BANKING_CHANGE_TEMPLATE,
  bankDetailsFromSettings,
  bankDetailsLines,
  deliverableEmail,
  findUnknownPlaceholders,
  noticeCompanyFromSettings,
  renderNoticeBodyHtml,
  renderNoticeSubject,
  validateNoticeContent,
  type NoticeCompany,
  type NoticeVars,
} from "@/lib/notices";
import { customerNoticeEmail } from "@/lib/email/templates";
import { sendNoticeSchema } from "@/lib/validations/notices";

const bankSettings = {
  bank_name: "Test Bank",
  bank_account_name: "THETHA TELECOM (PTY)LTD",
  bank_account_number: "1234567890",
  bank_branch_code: "250655",
  bank_account_type: "Business Cheque",
};

const company: NoticeCompany = noticeCompanyFromSettings({
  company_name: "THETHA TELECOM (PTY)LTD",
  email: "info@thethatelecom.co.za",
  phone: "0615135194",
  ...bankSettings,
});
const noBankCompany: NoticeCompany = { ...company, bank: null };
const vars: NoticeVars = { customerName: "Acme Attorneys", accountNumber: "ACM001", company };

describe("deliverableEmail", () => {
  it("accepts a single normal address and trims it", () => {
    expect(deliverableEmail("  accounts@acme.co.za ")).toBe("accounts@acme.co.za");
  });

  it("rejects empty, missing and malformed addresses", () => {
    for (const bad of ["", "   ", null, undefined, "no-at-sign", "a@b", "a@b.c", "two words@acme.co.za"]) {
      expect(deliverableEmail(bad)).toBeNull();
    }
  });

  it("rejects several addresses crammed into one field instead of guessing", () => {
    expect(deliverableEmail("a@acme.co.za; b@acme.co.za")).toBeNull();
    expect(deliverableEmail("a@acme.co.za, b@acme.co.za")).toBeNull();
    expect(deliverableEmail("a@acme.co.za b@acme.co.za")).toBeNull();
  });
});

describe("bank details", () => {
  it("needs bank name, account name and account number", () => {
    expect(bankDetailsFromSettings(bankSettings)).not.toBeNull();
    for (const field of ["bank_name", "bank_account_name", "bank_account_number"] as const) {
      expect(bankDetailsFromSettings({ ...bankSettings, [field]: "  " })).toBeNull();
    }
  });

  it("lists branch code and account type only when they're filled in", () => {
    const full = bankDetailsLines(bankDetailsFromSettings(bankSettings)!);
    expect(full).toEqual([
      "Bank: Test Bank",
      "Account name: THETHA TELECOM (PTY)LTD",
      "Account number: 1234567890",
      "Branch code: 250655",
      "Account type: Business Cheque",
    ]);
    const minimal = bankDetailsLines(
      bankDetailsFromSettings({ ...bankSettings, bank_branch_code: "", bank_account_type: "" })!
    );
    expect(minimal).toHaveLength(3);
  });
});

describe("placeholders", () => {
  it("flags typos so literal {braces} never reach customers", () => {
    expect(findUnknownPlaceholders("Hi {customer}, {customer_name} {customer}", { allowBankDetails: true })).toEqual(["customer"]);
  });

  it("allows bank details in the message but not the subject", () => {
    expect(findUnknownPlaceholders("{bank_details}", { allowBankDetails: true })).toEqual([]);
    expect(findUnknownPlaceholders("{bank_details}", { allowBankDetails: false })).toEqual(["bank_details"]);
  });

  it("ignores braces that aren't placeholder-shaped", () => {
    expect(findUnknownPlaceholders("Total {R100} and {Name}", { allowBankDetails: true })).toEqual([]);
  });
});

describe("validateNoticeContent", () => {
  it("accepts a normal notice", () => {
    expect(validateNoticeContent("Hello {customer_name}", "Pay into:\n\n{bank_details}", company)).toBeNull();
  });

  it("explains an unknown placeholder", () => {
    expect(validateNoticeContent("Hi", "Dear {nmae}", company)).toMatch(/Unknown placeholder \{nmae\}/);
  });

  it("blocks {bank_details} while the bank details are incomplete", () => {
    expect(validateNoticeContent("Hi", "{bank_details}", noBankCompany)).toMatch(/Settings > Bank details/);
    expect(validateNoticeContent("Hi", "No bank info here", noBankCompany)).toBeNull();
  });

  it("the built-in banking template is valid when bank details are set", () => {
    expect(validateNoticeContent(BANKING_CHANGE_TEMPLATE.subject, BANKING_CHANGE_TEMPLATE.body, company)).toBeNull();
  });
});

describe("renderNoticeSubject", () => {
  it("fills placeholders and tidies whitespace", () => {
    expect(renderNoticeSubject("Update for {customer_name}  from {company_name}", vars)).toBe(
      "Update for Acme Attorneys from THETHA TELECOM (PTY)LTD"
    );
  });

  it("leaves unknown placeholders and bank details alone", () => {
    expect(renderNoticeSubject("{bank_details} {nope}", vars)).toBe("{bank_details} {nope}");
  });
});

describe("renderNoticeBodyHtml", () => {
  it("turns blank lines into paragraphs and single newlines into line breaks", () => {
    const html = renderNoticeBodyHtml("First line\nsecond line\n\nNew paragraph", vars);
    expect(html).toBe("<p>First line<br>second line</p>\n<p>New paragraph</p>");
  });

  it("fills in per-customer values", () => {
    const html = renderNoticeBodyHtml("Account {account_number} for {customer_name}.", vars);
    expect(html).toContain("Account ACM001 for Acme Attorneys.");
  });

  it("escapes both the typed text and the substituted values", () => {
    const html = renderNoticeBodyHtml("<script>alert(1)</script> Hello {customer_name}", {
      ...vars,
      customerName: 'Evil <img src=x onerror="y"> & Co',
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Evil &lt;img src=x onerror=&quot;y&quot;&gt; &amp; Co");
  });

  it("shows a paragraph that is only {bank_details} as a highlighted box", () => {
    const html = renderNoticeBodyHtml("Pay here:\n\n{bank_details}\n\nThanks", vars);
    expect(html).toContain("background: #f6f6f6");
    expect(html).toContain("Bank: Test Bank<br>Account name: THETHA TELECOM (PTY)LTD<br>Account number: 1234567890");
    expect(html).not.toContain("{bank_details}");
  });

  it("puts bank details inline when used inside a sentence", () => {
    const html = renderNoticeBodyHtml("Pay to {bank_details} please.", vars);
    expect(html).toContain("Pay to Bank: Test Bank<br>Account name:");
  });

  it("makes a missing bank block obvious in the preview rather than silently blank", () => {
    const html = renderNoticeBodyHtml("{bank_details}", { ...vars, company: noBankCompany });
    expect(html).toContain("[bank details not set in Settings]");
  });
});

describe("customerNoticeEmail", () => {
  it("greets the customer and signs off from the company", () => {
    const { subject, html } = customerNoticeEmail({
      companyName: "THETHA TELECOM (PTY)LTD",
      customerName: "Acme <b>Attorneys</b>",
      subject: "Important update",
      bodyHtml: "<p>Body</p>",
    });
    expect(subject).toBe("Important update");
    expect(html).toContain("Dear Acme &lt;b&gt;Attorneys&lt;/b&gt;,");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("Kind regards,<br>THETHA TELECOM (PTY)LTD");
  });
});

describe("sendNoticeSchema", () => {
  const valid = {
    subject: "Hello",
    body: "World",
    customer_ids: ["8ba508b7-c5f7-425b-b168-2bf585bc45f7"],
    send_token: "7d86e05d-d977-4a8b-bf29-8661fa11fd5c",
  };

  it("accepts a complete request", () => {
    expect(sendNoticeSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a subject, a message, at least one customer and a send token", () => {
    expect(sendNoticeSchema.safeParse({ ...valid, subject: "  " }).success).toBe(false);
    expect(sendNoticeSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
    expect(sendNoticeSchema.safeParse({ ...valid, customer_ids: [] }).success).toBe(false);
    expect(sendNoticeSchema.safeParse({ ...valid, send_token: "not-a-uuid" }).success).toBe(false);
  });
});
