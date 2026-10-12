import { describe, it, expect } from "vitest";
import { signatureHtml, emailSignatureFromSettings, type SignatureSource } from "@/lib/email/signature";
import { invoiceSentEmail, quoteSentEmail, paymentReminderEmail, clientMagicLinkEmail } from "@/lib/email/templates";

const full: SignatureSource = {
  company_name: "THETHA TELECOM (PTY)LTD",
  logo_url: "https://example.supabase.co/storage/v1/object/public/company-assets/logo.png",
  phone: "0110000000",
  email: "info@thethatelecom.co.za",
  website: "https://www.thethatelecom.co.za",
  address_physical: "1676 Augusta Drive\r\n711 Waterbok Street\r\n\r\nTheresapark\r\n0182",
  registration_number: "2018/042433/07",
  vat_number: "4123456789",
  brand_color: "#ea580c",
};

const sig = (overrides: Partial<SignatureSource> = {}) => emailSignatureFromSettings({ ...full, ...overrides });

describe("signatureHtml", () => {
  it("includes every company detail that is filled in", () => {
    const html = signatureHtml(sig());
    expect(html).toContain("Kind regards,");
    expect(html).toContain("THETHA TELECOM (PTY)LTD");
    expect(html).toContain("0110000000");
    expect(html).toContain('href="mailto:info@thethatelecom.co.za"');
    expect(html).toContain('href="https://www.thethatelecom.co.za"');
    expect(html).toContain("1676 Augusta Drive, 711 Waterbok Street, Theresapark, 0182");
    expect(html).toContain("Reg. 2018/042433/07");
    expect(html).toContain("VAT 4123456789");
    expect(html).toContain("#ea580c");
    expect(html).toContain("<img");
  });

  it("leaves out anything left blank on the company profile", () => {
    const html = signatureHtml(
      sig({ phone: "", email: "", website: "", address_physical: "", registration_number: "", vat_number: "", logo_url: null })
    );
    expect(html).not.toContain("Tel");
    expect(html).not.toContain("Email");
    expect(html).not.toContain("Web");
    expect(html).not.toContain("Address");
    expect(html).not.toContain("Reg.");
    expect(html).not.toContain("VAT");
    expect(html).not.toContain("<img");
    expect(html).toContain("THETHA TELECOM (PTY)LTD");
  });

  it("escapes free-text fields", () => {
    const html = signatureHtml(
      sig({ company_name: 'Evil <script>alert(1)</script> "Ltd"', phone: "<b>1</b>", address_physical: "1 <i>Main</i> St" })
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>1</b>");
    expect(html).not.toContain("<i>Main</i>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never turns a non-web website value into a javascript: link", () => {
    const html = signatureHtml(sig({ website: "javascript:alert(1)" }));
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("javascript:alert(1)");
  });

  it("links a bare domain over https", () => {
    expect(signatureHtml(sig({ website: "www.thethatelecom.co.za" }))).toContain('href="https://www.thethatelecom.co.za"');
  });

  it("only embeds an https logo and only a valid hex accent colour", () => {
    expect(signatureHtml(sig({ logo_url: "http://insecure.example/logo.png" }))).not.toContain("<img");
    expect(signatureHtml(sig({ logo_url: "javascript:alert(1)" }))).not.toContain("<img");
    const html = signatureHtml(sig({ brand_color: "red; background: url(x)" }));
    expect(html).not.toContain("url(x)");
    expect(html).toContain("#1a1a1a");
  });
});

describe("signature in the email templates", () => {
  const base = { companyName: "Acme", customerName: "Customer", invoiceNumber: "INV-1" };

  it("replaces the old plain sign-off instead of repeating it", () => {
    for (const html of [
      invoiceSentEmail({ ...base, signature: sig() }).html,
      quoteSentEmail({ companyName: "Acme", customerName: "Customer", quoteNumber: "QUO-1", signature: sig() }).html,
    ]) {
      expect(html.match(/Kind regards/g)).toHaveLength(1);
    }
  });

  it("keeps the plain sign-off when no signature is passed", () => {
    const html = invoiceSentEmail(base).html;
    expect(html.match(/Kind regards/g)).toHaveLength(1);
    expect(html).not.toContain("Tel");
  });

  it("adds the signature to a payment reminder", () => {
    const html = paymentReminderEmail({ ...base, balanceDue: 10, dueDate: "2026-10-21", currency: "ZAR", signature: sig() }).html;
    expect(html).toContain("Kind regards,");
    expect(html).toContain("info@thethatelecom.co.za");
  });

  it("leaves the sign-in link email without one", () => {
    const html = clientMagicLinkEmail({ companyName: "Acme", loginUrl: "https://x.test/client/verify?token=t", expiresInMinutes: 15 }).html;
    expect(html).not.toContain("Kind regards");
  });
});

import { customerNoticeEmail, paymentReceiptEmail, recurringInvoiceGeneratedEmail, creditNoteIssuedEmail } from "@/lib/email/templates";
import { noticeCompanyFromSettings } from "@/lib/notices";

describe("signature on the customer notice", () => {
  const notice = { companyName: "Acme", subject: "Important", bodyHtml: "<p>We have a new name.</p>" };

  it("replaces the plain sign-off with the company signature", () => {
    const html = customerNoticeEmail({ ...notice, signature: sig() }).html;
    expect(html).toContain("We have a new name.");
    expect(html).toContain("0110000000");
    expect(html).toContain("info@thethatelecom.co.za");
    expect(html.match(/Kind regards/g)).toHaveLength(1);
  });

  it("keeps the plain sign-off when there is no signature", () => {
    const html = customerNoticeEmail(notice).html;
    expect(html.match(/Kind regards/g)).toHaveLength(1);
    expect(html).not.toContain("Tel");
  });

  it("is built from the company settings, so the composer preview and the real send match", () => {
    const company = noticeCompanyFromSettings({
      ...full,
      bank_name: "Bank",
      bank_account_name: "Acme",
      bank_account_number: "123",
      bank_branch_code: "250655",
      bank_account_type: "Cheque",
    });
    expect(company.signature.phone).toBe("0110000000");
    expect(company.signature.companyName).toBe("THETHA TELECOM (PTY)LTD");
    expect(customerNoticeEmail({ ...notice, signature: company.signature }).html).toContain("Reg. 2018/042433/07");
  });

  it("still builds a company from the few fields older callers pass", () => {
    const company = noticeCompanyFromSettings({
      company_name: "Acme",
      email: "a@acme.example",
      phone: "0110000001",
      bank_name: "",
      bank_account_name: "",
      bank_account_number: "",
      bank_branch_code: "",
      bank_account_type: "",
    });
    expect(company.bank).toBeNull();
    expect(company.signature.logoUrl).toBeNull();
    const html = customerNoticeEmail({ ...notice, signature: company.signature }).html;
    expect(html).toContain("0110000001");
    expect(html).not.toContain("<img");
  });
});

describe("signature on the other customer emails", () => {
  it("is on the payment receipt, recurring invoice and credit note emails, once", () => {
    const common = { companyName: "Acme", customerName: "Customer", currency: "ZAR", signature: sig() };
    const emails = [
      paymentReceiptEmail({ ...common, amount: 10, paymentDate: "2026-10-12" }),
      recurringInvoiceGeneratedEmail({ ...common, invoiceNumber: "INV-1", total: 10, dueDate: "2026-10-30" }),
      creditNoteIssuedEmail({ ...common, creditNoteNumber: "CN-1", total: 10 }),
    ];
    for (const { html } of emails) {
      expect(html).toContain("0110000000");
      expect(html.match(/Kind regards/g)).toHaveLength(1);
    }
  });
});
