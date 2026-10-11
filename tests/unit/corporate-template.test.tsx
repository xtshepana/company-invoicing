import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Image, renderToBuffer } from "@react-pdf/renderer";
import { CorporateTemplate, corporateColors, corporateTitle } from "@/lib/pdf/templates/corporate";
import { PDF_TEMPLATE_COMPONENTS, PDF_TEMPLATE_LABELS, resolvePdfTemplate } from "@/lib/pdf/templates";
import { PDF_TEMPLATES } from "@/lib/validations/company-settings";
import type { DocumentData } from "@/lib/pdf/document-data";
import type { CompanySettings } from "@/lib/config/system-settings";

function settings(overrides: Record<string, unknown> = {}): CompanySettings {
  return {
    company_name: "Acme Trading (Pty) Ltd",
    trading_name: "",
    registration_number: "2020/123456/07",
    vat_number: "",
    address_physical: "1 Main Road\nSandton\n2196",
    phone: "0110000000",
    email: "info@acme.example",
    website: "https://acme.example",
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
    ...overrides,
  } as unknown as CompanySettings;
}

const customer = {
  name: "Tokk Enterprise (Pty) Ltd",
  accountNo: "TOK003",
  contactPerson: "Thomas",
  address: "12 Delivery Street\nTheresapark",
  postalAddress: "PO Box 99\nTheresapark",
  email: "accounts@tokk.example",
  vatNumber: "4610285340",
};

function lines(count: number): DocumentData["lineItems"] {
  return Array.from({ length: count }, (_, i) => ({
    description: `Line item ${i + 1}`,
    quantity: 1,
    unitPrice: 100,
    discountPercent: 0,
    vatRate: 15,
    lineTotal: 115,
  }));
}

const invoice = (overrides: Partial<DocumentData> = {}): DocumentData => ({
  docKind: "invoice",
  docTitle: "INVOICE",
  number: "INV-000042",
  statusLabel: null,
  metaFields: [
    { label: "Invoice number", value: "INV-000042" },
    { label: "Invoice date", value: "9 Sep 2026" },
    { label: "Due date", value: "9 Oct 2026" },
    { label: "Reference", value: "PO-273373" },
  ],
  billToLabel: "Bill To",
  customer,
  lineItems: lines(3),
  totals: { subtotal: 300, discount: 0, vat: 45, total: 345, amountPaid: 100, balanceDue: 245 },
  notes: "Thank you.",
  terms: "30 days.",
  ...overrides,
});

const quote = (): DocumentData =>
  invoice({
    docKind: "quote",
    docTitle: "QUOTATION",
    number: "QUO-000007",
    metaFields: [
      { label: "Quote number", value: "QUO-000007" },
      { label: "Quote date", value: "9 Sep 2026" },
      { label: "Expiry date", value: "9 Oct 2026" },
    ],
    totals: { subtotal: 300, discount: 0, vat: 45, total: 345 },
  });

const creditNote = (): DocumentData =>
  invoice({
    docKind: "credit_note",
    docTitle: "CREDIT NOTE",
    number: "CN-000003",
    statusLabel: "Issued",
    metaFields: [
      { label: "Credit note number", value: "CN-000003" },
      { label: "Date", value: "9 Sep 2026" },
      { label: "Reason", value: "Returned goods" },
    ],
    totals: { subtotal: 300, discount: 0, vat: 45, total: 345 },
  });

/** Every piece of text in the rendered tree, found by walking it (calling the template's own small components on the way). */
function textOf(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element.props) return [];
  if (typeof element.type === "function") return textOf((element.type as (props: unknown) => unknown)(element.props));
  return textOf(element.props.children);
}

function countOf(node: unknown, type: unknown): number {
  if (!node || typeof node !== "object") return 0;
  if (Array.isArray(node)) return node.reduce((sum: number, child) => sum + countOf(child, type), 0);
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element.props) return 0;
  const own = element.type === type ? 1 : 0;
  const next = typeof element.type === "function" ? (element.type as (props: unknown) => unknown)(element.props) : element.props.children;
  return own + countOf(next, type);
}

const render = (data: DocumentData, overrides: Record<string, unknown> = {}) => CorporateTemplate({ data, settings: settings(overrides) });
const text = (data: DocumentData, overrides: Record<string, unknown> = {}) => textOf(render(data, overrides)).join("\n");
const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;

describe("the title bar", () => {
  it("says Tax Invoice only for a VAT-registered company, and a plain Invoice otherwise", () => {
    expect(corporateTitle("invoice", true)).toBe("Tax Invoice");
    expect(corporateTitle("invoice", false)).toBe("Invoice");
    expect(corporateTitle("credit_note", true)).toBe("Tax Credit Note");
    expect(corporateTitle("credit_note", false)).toBe("Credit Note");
    expect(corporateTitle("quote", true)).toBe("Quotation");
    expect(corporateTitle("quote", false)).toBe("Quotation");
  });

  it("is what the rendered document shows", () => {
    expect(textOf(render(invoice(), { vat_registered: true }))).toContain("Tax Invoice");
    const plain = textOf(render(invoice()));
    expect(plain).toContain("Invoice");
    expect(plain).not.toContain("Tax Invoice");
  });
});

describe("what the document shows", () => {
  it("lays out the company, customer, document and reference details", () => {
    const out = text(invoice(), { vat_registered: true, vat_number: "4830195584" });
    for (const expected of [
      "Acme Trading (Pty) Ltd",
      "info@acme.example",
      "0110000000",
      "2020/123456/07",
      "4830195584",
      "Tokk Enterprise (Pty) Ltd",
      "TOK003",
      "PO-273373",
      "4610285340",
      "INV-000042",
      "9 Sep 2026",
      "Due By",
      "Delivery Address:",
    ]) {
      expect(out, expected).toContain(expected);
    }
  });

  it("bills to the postal address when there is one, and falls back to the physical address", () => {
    expect(text(invoice())).toContain("PO Box 99");
    const noPostal = text(invoice({ customer: { ...customer, postalAddress: "" } }));
    expect(noPostal).not.toContain("PO Box 99");
    // Both boxes then show the one address that exists.
    expect(noPostal.split("12 Delivery Street").length - 1).toBe(2);
  });

  it("adapts to the kind of document", () => {
    const inv = text(invoice());
    expect(inv).toContain("Banking Details");
    expect(inv).toContain("Balance Due");
    expect(inv).toContain("Amount Paid");

    const q = text(quote());
    expect(q).toContain("Quoted For:");
    expect(q).toContain("Expiry");
    expect(q).not.toContain("Banking Details");
    expect(q).not.toContain("Balance Due");

    const cn = text(creditNote());
    expect(cn).toContain("Reason");
    expect(cn).toContain("Returned goods");
    expect(cn).toContain("Status");
    expect(cn).toContain("Issued");
    expect(cn).not.toContain("Banking Details");
    expect(cn).not.toContain("Balance Due");
  });

  it("only shows a Discount row when there is a discount", () => {
    expect(text(invoice())).not.toContain("Discount");
    expect(text(invoice({ totals: { subtotal: 300, discount: 20, vat: 45, total: 325, amountPaid: 0, balanceDue: 325 } }))).toContain("Discount");
  });

  it("leaves out sections that are empty", () => {
    const out = text(invoice({ notes: "", terms: "" }), { bank_name: "" });
    expect(out).not.toContain("Notes");
    expect(out).not.toContain("Terms");
    expect(out).not.toContain("Banking Details");
  });

  it("respects the 'show company name' setting", () => {
    expect(text(invoice(), { show_company_name: false })).not.toContain("Acme Trading (Pty) Ltd");
  });

  it("shows the logo only when the company has one", () => {
    expect(countOf(render(invoice()), Image)).toBe(0);
    expect(countOf(render(invoice(), { logo_url: "data:image/png;base64,AAAA" }), Image)).toBe(1);
  });
});

describe("the banking details box", () => {
  // The text walker puts each JSX text piece on its own line ("Acc No: " then the number); join a label to its value.
  const flat = (data: DocumentData, overrides: Record<string, unknown> = {}) => text(data, overrides).replace(/: ?\n/g, ": ");

  it("shows the heading, the customer's account number as the payment reference, and every banking line", () => {
    const out = flat(invoice());
    for (const expected of ["Banking Details", "Payment Reference: TOK003", "Test Bank", "Acme Trading", "Account Type: Business Cheque", "Branch Code: 250655", "Acc No: 1234567890"]) {
      expect(out, expected).toContain(expected);
    }
  });

  it("leaves out the payment reference when the customer has no account number", () => {
    const out = flat(invoice({ customer: { ...customer, accountNo: "" } }));
    expect(out).toContain("Banking Details");
    expect(out).not.toContain("Payment Reference");
  });

  it("skips banking lines that are empty instead of printing a bare label", () => {
    const out = flat(invoice(), { bank_account_type: "", bank_branch_code: "" });
    expect(out).toContain("Acc No: 1234567890");
    expect(out).not.toContain("Account Type:");
    expect(out).not.toContain("Branch Code:");
  });

  it("is only on invoices, never on a quote or credit note", () => {
    expect(flat(quote())).not.toContain("Payment Reference");
    expect(flat(creditNote())).not.toContain("Payment Reference");
  });
});

/** The effective value of one style property (e.g. backgroundColor) on every element of the rendered tree, found by walking it - where a style array sets it twice, the later entry wins, as it does in the PDF. */
function styleValues(node: unknown, property: string): string[] {
  if (node === null || node === undefined || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => styleValues(child, property));
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!element.props) return [];
  const own: string[] = [];
  const style = element.props.style as unknown;
  let effective: string | undefined;
  for (const entry of Array.isArray(style) ? style : [style]) {
    const value = entry && typeof entry === "object" ? (entry as Record<string, unknown>)[property] : undefined;
    if (typeof value === "string") effective = value.toLowerCase();
  }
  if (effective) own.push(effective);
  const next = typeof element.type === "function" ? (element.type as (props: unknown) => unknown)(element.props) : element.props.children;
  return [...own, ...styleValues(next, property)];
}

describe("the template colours", () => {
  it("falls back to navy and orange when the company has no brand colours", () => {
    expect(corporateColors(settings({ brand_color: null, brand_color_secondary: null }))).toEqual({
      primary: "#00008b",
      secondary: "#e0731e",
      onPrimary: "#ffffff",
      onSecondary: "#ffffff",
    });
  });

  it("uses the brand colour and the second logo colour", () => {
    const colors = corporateColors(settings({ brand_color: "#02b0e2", brand_color_secondary: "#737373" }));
    expect(colors.primary).toBe("#02b0e2");
    expect(colors.secondary).toBe("#737373");
  });

  it("derives a darker secondary from the brand colour when there is no second colour", () => {
    expect(corporateColors(settings({ brand_color: "#02b0e2", brand_color_secondary: null })).secondary).toBe("#017293");
  });

  it("puts black text on a light colour and white text on a dark one", () => {
    expect(corporateColors(settings({ brand_color: "#ffeb3b", brand_color_secondary: "#011c42" }))).toMatchObject({ onPrimary: "#000000", onSecondary: "#ffffff" });
  });

  it("ignores a colour that is not a valid hex value", () => {
    const colors = corporateColors(settings({ brand_color: "red; background:url(x)", brand_color_secondary: "#12345" }));
    expect(colors.primary).toBe("#00008b");
    expect(colors.secondary).toBe("#e0731e");
  });

  it("paints the title bar, items header and the Total and Balance Due rows in those colours", () => {
    const fills = styleValues(render(invoice(), { brand_color: "#02b0e2", brand_color_secondary: "#737373" }), "backgroundColor");
    expect(fills.filter((c) => c === "#02b0e2").length).toBeGreaterThanOrEqual(2); // title bar + Total label
    expect(fills.filter((c) => c === "#737373").length).toBeGreaterThanOrEqual(2); // items header + Balance Due label
    expect(fills).not.toContain("#00008b");
    expect(fills).not.toContain("#e0731e");
  });

  it("keeps the original navy and orange on a company without brand colours", () => {
    const fills = styleValues(render(invoice(), { brand_color: null, brand_color_secondary: null }), "backgroundColor");
    expect(fills).toContain("#00008b");
    expect(fills).toContain("#e0731e");
  });

  it("renders a valid single-page PDF in custom colours", async () => {
    const pdf = await renderToBuffer(render(invoice(), { brand_color: "#02b0e2", brand_color_secondary: "#737373" }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  }, 60_000);
});

describe("rendering to a real PDF", () => {
  it("produces a valid, single-page PDF for each kind of document", async () => {
    for (const data of [invoice(), quote(), creditNote()]) {
      const pdf = await renderToBuffer(render(data));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pageCount(pdf), data.docKind).toBe(1);
    }
  }, 60_000);

  it("flows a long document over several pages instead of overflowing", async () => {
    const pdf = await renderToBuffer(render(invoice({ lineItems: lines(60) })));
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("copes with a customer who has no address, reference or VAT number, and long text", async () => {
    const sparse = invoice({
      customer: { name: "X", accountNo: "", contactPerson: "", address: "", postalAddress: "", email: "", vatNumber: "" },
      metaFields: [
        { label: "Invoice number", value: "INV-1" },
        { label: "Invoice date", value: "1 Jan 2026" },
      ],
      notes: "A very long note. ".repeat(60),
      lineItems: [{ description: "An extremely long description ".repeat(15), quantity: 1, unitPrice: 1, discountPercent: 0, vatRate: 0, lineTotal: 1 }],
    });
    const pdf = await renderToBuffer(render(sparse));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 60_000);
});

describe("being selectable", () => {
  it("is registered, labelled and chosen when asked for by name", () => {
    expect(PDF_TEMPLATES).toContain("corporate");
    expect(PDF_TEMPLATE_COMPONENTS.corporate).toBe(CorporateTemplate);
    expect(PDF_TEMPLATE_LABELS.corporate).toBe("Corporate");
    expect(resolvePdfTemplate("corporate")).toBe(CorporateTemplate);
  });

  it("every template the app lists has a component and a label, so none can be added half-way", () => {
    for (const key of PDF_TEMPLATES) {
      expect(PDF_TEMPLATE_COMPONENTS[key], `${key} component`).toBeTypeOf("function");
      expect(PDF_TEMPLATE_LABELS[key], `${key} label`).toBeTruthy();
    }
    expect(Object.keys(PDF_TEMPLATE_COMPONENTS).sort()).toEqual([...PDF_TEMPLATES].sort());
  });

  it("the database accepts every template the app offers (the newest migration that sets the check lists them all)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "0037_corporate_pdf_template.sql"), "utf8");
    for (const key of PDF_TEMPLATES) expect(sql, key).toContain(`'${key}'`);
  });
});
