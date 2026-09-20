import { describe, expect, it } from "vitest";
import { generateCustomerReferenceCandidate } from "@/lib/customer-reference";

describe("generateCustomerReferenceCandidate", () => {
  it("uses the first 3 letters of the company name, uppercased, followed by a 5-digit number", () => {
    const ref = generateCustomerReferenceCandidate("Acme Traders");
    expect(ref).toMatch(/^ACM\d{5}$/);
  });

  it("strips non-letter characters before taking the first 3", () => {
    const ref = generateCustomerReferenceCandidate("7-Eleven");
    expect(ref).toMatch(/^ELE\d{5}$/);
  });

  it("pads with X when the company name has fewer than 3 letters", () => {
    const ref = generateCustomerReferenceCandidate("A1");
    expect(ref).toMatch(/^AXX\d{5}$/);
  });

  it("pads with X when the company name has no letters at all", () => {
    const ref = generateCustomerReferenceCandidate("123");
    expect(ref).toMatch(/^XXX\d{5}$/);
  });

  it("generates different candidates across calls (random digits)", () => {
    const refs = new Set(Array.from({ length: 20 }, () => generateCustomerReferenceCandidate("Acme")));
    expect(refs.size).toBeGreaterThan(1);
  });
});
