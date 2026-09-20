import { describe, expect, it } from "vitest";
import { customerSchema } from "@/lib/validations/customers";
import { productSchema } from "@/lib/validations/products";

describe("customerSchema", () => {
  it("accepts a minimal valid customer", () => {
    const result = customerSchema.safeParse({
      customer_type: "business",
      company_name: "ABC Technologies",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty company name", () => {
    const result = customerSchema.safeParse({ customer_type: "business", company_name: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = customerSchema.safeParse({
      customer_type: "business",
      company_name: "ABC Technologies",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty payment_terms_days to mean 'use company default'", () => {
    const result = customerSchema.safeParse({
      customer_type: "business",
      company_name: "ABC Technologies",
      payment_terms_days: "",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payment_terms_days).toBe("");
  });

  it("accepts a negative opening balance (customer already in credit)", () => {
    const result = customerSchema.safeParse({
      customer_type: "individual",
      company_name: "Jane Doe",
      opening_balance: -500,
    });
    expect(result.success).toBe(true);
  });
});

describe("productSchema", () => {
  it("accepts a minimal valid product", () => {
    const result = productSchema.safeParse({
      type: "service",
      name: "Monthly IT Support",
      selling_price: 2500,
      vat_rate: 15,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative selling price", () => {
    const result = productSchema.safeParse({
      type: "product",
      name: "Widget",
      selling_price: -10,
      vat_rate: 15,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a VAT rate over 100", () => {
    const result = productSchema.safeParse({
      type: "product",
      name: "Widget",
      selling_price: 10,
      vat_rate: 150,
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty cost price", () => {
    const result = productSchema.safeParse({
      type: "product",
      name: "Widget",
      cost_price: "",
      selling_price: 10,
      vat_rate: 15,
    });
    expect(result.success).toBe(true);
  });
});
