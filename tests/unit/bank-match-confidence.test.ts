import { describe, expect, it, vi } from "vitest";

// Same reasoning as tests/unit/permissions.test.ts: importing
// server/services/bank-transactions.ts pulls in "server-only" and
// lib/supabase/server.ts (next/headers) purely as a side effect of the
// module graph, even though the two pure functions under test never
// touch either.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const { computePaymentMatchConfidence, computeInvoiceMatchConfidence } = await import(
  "@/server/services/bank-transactions"
);

describe("computePaymentMatchConfidence", () => {
  it("is high when the amount matches and the dates are within 3 days", () => {
    expect(computePaymentMatchConfidence(true, 0)).toBe("high");
    expect(computePaymentMatchConfidence(true, 3)).toBe("high");
  });

  it("is medium when the amount matches but the dates are more than 3 days apart", () => {
    expect(computePaymentMatchConfidence(true, 3.01)).toBe("medium");
    expect(computePaymentMatchConfidence(true, 30)).toBe("medium");
  });

  it("is low whenever the amount doesn't match, regardless of how close the dates are — amount is the primary signal", () => {
    expect(computePaymentMatchConfidence(false, 0)).toBe("low");
    expect(computePaymentMatchConfidence(false, 100)).toBe("low");
  });
});

describe("computeInvoiceMatchConfidence", () => {
  it("is high when both the amount and the customer name match", () => {
    expect(computeInvoiceMatchConfidence(true, true)).toBe("high");
  });

  it("is medium when exactly one of amount or name matches", () => {
    expect(computeInvoiceMatchConfidence(true, false)).toBe("medium");
    expect(computeInvoiceMatchConfidence(false, true)).toBe("medium");
  });

  it("is low when neither signal matches", () => {
    expect(computeInvoiceMatchConfidence(false, false)).toBe("low");
  });
});
