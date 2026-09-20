import { describe, expect, it } from "vitest";
import { recordPaymentSchema, applyCreditSchema } from "@/lib/validations/payments";

describe("recordPaymentSchema", () => {
  it("accepts a minimal valid payment with no allocations (pure credit)", () => {
    const result = recordPaymentSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      payment_date: "2026-09-19",
      amount: 1000,
      payment_method: "eft",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.invoice_allocations).toEqual([]);
  });

  it("accepts multiple invoice allocations", () => {
    const result = recordPaymentSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      payment_date: "2026-09-19",
      amount: 1500,
      payment_method: "cash",
      invoice_allocations: [
        { invoice_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", amount: 1000 },
        { invoice_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e", amount: 500 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    const result = recordPaymentSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      payment_date: "2026-09-19",
      amount: 0,
      payment_method: "eft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid payment method", () => {
    const result = recordPaymentSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      payment_date: "2026-09-19",
      amount: 100,
      payment_method: "bitcoin",
    });
    expect(result.success).toBe(false);
  });
});

describe("applyCreditSchema", () => {
  it("accepts a valid credit application", () => {
    const result = applyCreditSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      invoice_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      amount: 250,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = applyCreditSchema.safeParse({
      customer_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      invoice_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
      amount: -1,
    });
    expect(result.success).toBe(false);
  });
});
