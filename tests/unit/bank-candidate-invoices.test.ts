import { beforeEach, describe, expect, it, vi } from "vitest";

// Bank-line -> invoice suggestions. Customers are identified by the account number the payer quoted (the "Payment
// Reference" printed on the invoice) before anything else; names only count by their distinguishing words.
vi.mock("server-only", () => ({}));

/** A query-builder stand-in: every method returns itself, awaiting it yields `result`. */
function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "gt", "not", "order", "limit", "eq"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder;
}

const state = { invoices: [] as unknown[], customers: [] as unknown[] };

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => query({ data: table === "invoices" ? state.invoices : state.customers, error: null }),
  }),
}));

const { listCandidateInvoices, computeInvoiceMatchConfidence } = await import("@/server/services/bank-transactions");

function invoice(id: string, customerId: string, name: string, reference: string, balance: number) {
  return {
    id,
    customer_id: customerId,
    invoice_number: `INV-${id}`,
    due_date: "2026-10-01",
    total: balance,
    balance_due: balance,
    customers: { company_name: name, customer_reference: reference },
  };
}

const CUSTOMERS = [
  { name: "Baloyi Katlego Attorneys", ref: "BAL007" },
  { name: "Baloyi TS & Morobe Inc", ref: "BAL008" },
  { name: "Chabalala M Attorneys", ref: "CHA011" },
  { name: "Davhana N Attorneys", ref: "DAV014" },
  { name: "Fatola Attorneys", ref: "FAT022" },
  { name: "Motsepe Attorneys", ref: "MOT044" },
  { name: "Kichose Motors", ref: "KIC033" },
];

beforeEach(() => {
  state.customers = CUSTOMERS.map((c) => ({ company_name: c.name, customer_reference: c.ref }));
  state.invoices = [
    invoice("1", "c-bal7", "Baloyi Katlego Attorneys", "BAL007", 1500),
    invoice("2", "c-bal8", "Baloyi TS & Morobe Inc", "BAL008", 1500),
    invoice("3", "c-cha", "Chabalala M Attorneys", "CHA011", 1500),
    invoice("4", "c-dav", "Davhana N Attorneys", "DAV014", 900),
    invoice("5", "c-kic", "Kichose Motors", "KIC033", 2500),
  ];
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe("listCandidateInvoices", () => {
  it("when the payer quotes an account number, suggests only that customer - even though other customers owe the same amount", async () => {
    const result = await listCandidateInvoices(1500, "FNB EFT BAL008 OCT", null);

    expect(ids(result)).toEqual(["2"]);
    expect(result[0].accountMatches).toBe(true);
    expect(result[0].confidence).toBe("high");
  });

  it("finds the account number in the reference as well as the description", async () => {
    const result = await listCandidateInvoices(1500, "ABSA TRANSFER", "bal007");

    expect(ids(result)).toEqual(["1"]);
  });

  it("still suggests the quoted customer's invoice when the amount is different (a part payment)", async () => {
    const result = await listCandidateInvoices(700, "EFT DAV014", null);

    expect(ids(result)).toEqual(["4"]);
    expect(result[0].amountMatches).toBe(false);
    expect(result[0].confidence).toBe("medium");
  });

  it("does not let a customer's name match when the payer quoted a different customer's account number", async () => {
    const result = await listCandidateInvoices(1500, "KICHOSE MOTORS CHA011", null);

    expect(ids(result)).toEqual(["3"]);
  });

  it("falls back to the usual amount match when the quoted customer has nothing outstanding", async () => {
    const result = await listCandidateInvoices(2500, "EFT FAT022", null); // FAT022 owes nothing

    expect(ids(result)).toEqual(["5"]);
    expect(result[0].accountMatches).toBe(false);
  });

  it("without an account number, a bare 'attorneys' no longer lights up every attorney customer", async () => {
    const result = await listCandidateInvoices(1234, "TRUST ACCOUNT ATTORNEYS PAYMENT", null);

    expect(result).toEqual([]);
  });

  it("without an account number, a distinguishing word in the name still counts", async () => {
    const result = await listCandidateInvoices(2500, "KICHOSE MOTORS PAYMENT", null);

    expect(ids(result)).toEqual(["5"]);
    expect(result[0].nameMatches).toBe(true);
    expect(result[0].amountMatches).toBe(true);
    expect(result[0].confidence).toBe("high");
  });

  it("ranks the amount match above a name-only match", async () => {
    const result = await listCandidateInvoices(900, "DAVHANA", null);

    expect(result[0].id).toBe("4");
  });

  it("returns nothing for a debit (zero or negative amount)", async () => {
    expect(await listCandidateInvoices(0, "BAL007", null)).toEqual([]);
    expect(await listCandidateInvoices(-5, "BAL007", null)).toEqual([]);
  });
});

describe("computeInvoiceMatchConfidence with an account number", () => {
  it("is high when the account number and the amount agree", () => {
    expect(computeInvoiceMatchConfidence(true, false, true)).toBe("high");
  });

  it("is medium for an account number alone (the amount may be a part payment)", () => {
    expect(computeInvoiceMatchConfidence(false, false, true)).toBe("medium");
  });

  it("is unchanged without an account number", () => {
    expect(computeInvoiceMatchConfidence(true, true)).toBe("high");
    expect(computeInvoiceMatchConfidence(true, false)).toBe("medium");
    expect(computeInvoiceMatchConfidence(false, true)).toBe("medium");
    expect(computeInvoiceMatchConfidence(false, false)).toBe("low");
  });
});
