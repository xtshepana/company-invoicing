import { beforeEach, describe, expect, it, vi } from "vitest";

// The notice a customer receives must carry the company signature (logo, phone, email...). This goes through the real
// sendNoticeTest so a send path that forgets to attach it fails here, with the mailer and the database replaced.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/server/services/audit", () => ({ recordAuditLog: vi.fn() }));

type Sent = { html: string; subject: string; to: string; fromName?: string };
const sendEmail = vi.fn<(params: Sent) => Promise<{ status: "sent" }>>(async () => ({ status: "sent" }));
vi.mock("@/server/services/email", () => ({ sendEmail: (params: Sent) => sendEmail(params) }));

vi.mock("@/lib/config/system-settings", () => ({
  getCompanySettings: async () => ({
    company_name: "THETHA TELECOM (PTY)LTD",
    logo_url: "https://example.supabase.co/storage/v1/object/public/company-assets/logo.png",
    phone: "0110000000",
    email: "info@thethatelecom.co.za",
    website: "https://www.thethatelecom.co.za",
    address_physical: "1 Main Road\nSandton\n2196",
    registration_number: "2018/042433/07",
    vat_number: "",
    brand_color: "#011c42",
    bank_name: "Test Bank",
    bank_account_name: "Thetha Telecom",
    bank_account_number: "1234567890",
    bank_branch_code: "250655",
    bank_account_type: "Business Cheque",
  }),
}));

import { sendNoticeTest } from "@/server/services/notices";

const actor = { id: "admin-1", email: "admin@example.test" } as Parameters<typeof sendNoticeTest>[0]["actor"];

beforeEach(() => sendEmail.mockClear());

describe("sendNoticeTest", () => {
  it("sends the notice with the company signature and no duplicate sign-off", async () => {
    const result = await sendNoticeTest({
      actor,
      subject: "Important: Kati Technologies is now {company_name}",
      body: "Dear {customer_name},\n\nKati Technologies is now {company_name}.\n\n{bank_details}\n\nQuote {account_number}.",
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("admin@example.test");
    expect(sent.subject).toBe("[TEST] Important: Kati Technologies is now THETHA TELECOM (PTY)LTD");
    expect(sent.fromName).toBe("THETHA TELECOM (PTY)LTD");
    expect(sent.html).toContain("Kati Technologies is now THETHA TELECOM (PTY)LTD.");
    expect(sent.html).toContain("Account number: 1234567890"); // the bank block placeholder
    // the signature block
    expect(sent.html).toContain("0110000000");
    expect(sent.html).toContain('href="mailto:info@thethatelecom.co.za"');
    expect(sent.html).toContain("1 Main Road, Sandton, 2196");
    expect(sent.html).toContain("Reg. 2018/042433/07");
    expect(sent.html).toContain("<img");
    expect(sent.html.match(/Kind regards/g)).toHaveLength(1);
  });

  it("rejects an unknown placeholder before sending anything", async () => {
    const result = await sendNoticeTest({ actor, subject: "Hi", body: "Dear {customer_nmae}" });

    expect(result.ok).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
