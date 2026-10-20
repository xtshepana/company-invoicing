import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { showsBankingDetails } from "@/lib/pdf/banking";
import { PDF_TEMPLATE_COMPONENTS } from "@/lib/pdf/templates";
import { PDF_TEMPLATES } from "@/lib/validations/company-settings";
import type { DocumentData } from "@/lib/pdf/document-data";
import type { CompanySettings } from "@/lib/config/system-settings";

// Banking details are printed on invoices and quotations, never on credit notes, in every template.
const settings = {
  company_name: "Acme Trading (Pty) Ltd",
  trading_name: "",
  registration_number: "2020/123456/07",
  vat_number: "",
  address_physical: "1 Main Road\nSandton\n2196",
  phone: "0110000000",
  email: "info@acme.example",
  website: "",
  bank_name: "Test Bank",
  bank_account_name: "Acme Trading",
  bank_account_number: "1234567890",
  bank_branch_code: "250655",
  bank_account_type: "Business Cheque",
  default_currency: "ZAR",
  default_invoice_footer: "",
  show_company_name: true,
  vat_registered: false,
  logo_url: null,
} as unknown as CompanySettings;

function document(docKind: DocumentData["docKind"]): DocumentData {
  const title = { invoice: "INVOICE", quote: "QUOTATION", credit_note: "CREDIT NOTE" }[docKind];
  return {
    docKind,
    docTitle: title,
    number: "DOC-000001",
    statusLabel: null,
    metaFields: [
      { label: "Number", value: "DOC-000001" },
      { label: "Date", value: "12 Oct 2026" },
    ],
    billToLabel: "Bill To",
    customer: { name: "Tokk Enterprise (Pty) Ltd", accountNo: "TOK003", contactPerson: "", address: "12 Delivery Street", postalAddress: "", email: "", vatNumber: "" },
    lineItems: [{ description: "Line item", quantity: 1, unitPrice: 100, discountPercent: 0, vatRate: 15, lineTotal: 115 }],
    totals: docKind === "invoice" ? { subtotal: 100, discount: 0, vat: 15, total: 115, amountPaid: 0, balanceDue: 115 } : { subtotal: 100, discount: 0, vat: 15, total: 115 },
    notes: "A note.",
    terms: "",
  };
}

/** Every piece of text in the rendered tree, found by walking it (calling each template component on the way). */
function textOf(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element.props) return [];
  if (typeof element.type === "function") return textOf((element.type as (props: unknown) => unknown)(element.props));
  return textOf(element.props.children);
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;

describe("showsBankingDetails", () => {
  it("is true for invoices and quotations, false for credit notes", () => {
    expect(showsBankingDetails("invoice")).toBe(true);
    expect(showsBankingDetails("quote")).toBe(true);
    expect(showsBankingDetails("credit_note")).toBe(false);
  });
});

describe("banking details in every PDF template", () => {
  for (const key of PDF_TEMPLATES) {
    describe(key, () => {
      const lines = (kind: DocumentData["docKind"]) =>
        textOf(PDF_TEMPLATE_COMPONENTS[key]({ data: document(kind), settings }))
          .join("\n")
          .replace(/: ?\n/g, ": ");

      it("shows them on an invoice and on a quotation, with the account number and bank name", () => {
        for (const kind of ["invoice", "quote"] as const) {
          const out = lines(kind);
          expect(out, `${key} ${kind}`).toContain("Banking Details");
          expect(out, `${key} ${kind}`).toContain("Test Bank");
          expect(out, `${key} ${kind}`).toContain("Acc No: 1234567890");
        }
      });

      it("never shows them on a credit note", () => {
        const out = lines("credit_note");
        expect(out).not.toContain("Banking Details");
        expect(out).not.toContain("1234567890");
      });

      it("keeps the notes on a quotation next to the banking details", () => {
        expect(lines("quote")).toContain("A note.");
      });
    });
  }

  it("still renders a valid single-page PDF for a quotation in every template", async () => {
    for (const key of PDF_TEMPLATES) {
      const pdf = await renderToBuffer(PDF_TEMPLATE_COMPONENTS[key]({ data: document("quote"), settings }));
      expect(pdf.subarray(0, 5).toString(), key).toBe("%PDF-");
      expect(pageCount(pdf), key).toBe(1);
    }
  }, 120_000);
});
