import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { documentTitle } from "@/lib/pdf/document-title";
import { PDF_TEMPLATE_COMPONENTS } from "@/lib/pdf/templates";
import { PDF_TEMPLATES } from "@/lib/validations/company-settings";
import type { DocumentData } from "@/lib/pdf/document-data";
import type { CompanySettings } from "@/lib/config/system-settings";

function settings(vatRegistered: boolean): CompanySettings {
  return {
    company_name: "Acme Trading (Pty) Ltd",
    trading_name: "",
    registration_number: "2020/123456/07",
    vat_number: vatRegistered ? "4830195584" : "",
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
    vat_registered: vatRegistered,
    logo_url: null,
  } as unknown as CompanySettings;
}

function document(docKind: DocumentData["docKind"]): DocumentData {
  const isInvoice = docKind === "invoice";
  return {
    docKind,
    docTitle: docKind === "invoice" ? "INVOICE" : docKind === "quote" ? "QUOTATION" : "CREDIT NOTE",
    number: "DOC-000001",
    statusLabel: null,
    metaFields: [
      { label: "Number", value: "DOC-000001" },
      { label: "Date", value: "9 Sep 2026" },
    ],
    billToLabel: "Bill To",
    customer: { name: "Tokk Enterprise (Pty) Ltd", accountNo: "TOK003", contactPerson: "", address: "12 Delivery Street", postalAddress: "", email: "", vatNumber: "" },
    lineItems: [{ description: "Line item", quantity: 1, unitPrice: 100, discountPercent: 0, vatRate: 15, lineTotal: 115 }],
    totals: isInvoice
      ? { subtotal: 100, discount: 0, vat: 15, total: 115, amountPaid: 0, balanceDue: 115 }
      : { subtotal: 100, discount: 0, vat: 15, total: 115 },
    notes: "",
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

describe("documentTitle", () => {
  it("is Tax Invoice / Tax Credit Note for a VAT-registered company", () => {
    expect(documentTitle("invoice", true)).toBe("Tax Invoice");
    expect(documentTitle("credit_note", true)).toBe("Tax Credit Note");
  });

  it("is a plain Invoice / Credit Note when the company is not VAT-registered", () => {
    expect(documentTitle("invoice", false)).toBe("Invoice");
    expect(documentTitle("credit_note", false)).toBe("Credit Note");
  });

  it("is always Quotation for a quote, VAT-registered or not (a quote is not a tax document)", () => {
    expect(documentTitle("quote", true)).toBe("Quotation");
    expect(documentTitle("quote", false)).toBe("Quotation");
  });
});

describe("every PDF template prints the shared title", () => {
  const cases: { kind: DocumentData["docKind"]; vat: boolean; expected: string }[] = [
    { kind: "invoice", vat: true, expected: "TAX INVOICE" },
    { kind: "invoice", vat: false, expected: "INVOICE" },
    { kind: "credit_note", vat: true, expected: "TAX CREDIT NOTE" },
    { kind: "credit_note", vat: false, expected: "CREDIT NOTE" },
    { kind: "quote", vat: true, expected: "QUOTATION" },
  ];

  for (const key of PDF_TEMPLATES) {
    it(`${key}: ${cases.map((c) => c.expected).join(", ")}`, () => {
      const Template = PDF_TEMPLATE_COMPONENTS[key];
      for (const { kind, vat, expected } of cases) {
        const lines = textOf(Template({ data: document(kind), settings: settings(vat) })).map((t) => t.trim().toUpperCase());
        expect(lines, `${key} ${kind} vat=${vat}`).toContain(expected);
        if (!vat && kind !== "quote") expect(lines.some((t) => t.startsWith("TAX ")), `${key} ${kind} must not say Tax when not VAT-registered`).toBe(false);
      }
    });
  }

  it("still renders to a valid single-page PDF with the longest title, in every template", async () => {
    for (const key of PDF_TEMPLATES) {
      const pdf = await renderToBuffer(PDF_TEMPLATE_COMPONENTS[key]({ data: document("credit_note"), settings: settings(true) }));
      expect(pdf.subarray(0, 5).toString(), key).toBe("%PDF-");
      expect(pageCount(pdf), key).toBe(1);
    }
  }, 120_000);
});
