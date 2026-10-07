import { describe, it, expect } from "vitest";
import { resolveCc } from "@/lib/email/cc";

describe("resolveCc", () => {
  it("returns the configured accounts address", () => {
    expect(resolveCc("customer@example.com", "accounts@thethatelecom.co.za")).toBe("accounts@thethatelecom.co.za");
  });

  it("trims stray whitespace", () => {
    expect(resolveCc("customer@example.com", "  accounts@thethatelecom.co.za ")).toBe("accounts@thethatelecom.co.za");
  });

  it("sends no CC when nothing is configured", () => {
    expect(resolveCc("customer@example.com", null)).toBeUndefined();
    expect(resolveCc("customer@example.com", undefined)).toBeUndefined();
    expect(resolveCc("customer@example.com", "")).toBeUndefined();
    expect(resolveCc("customer@example.com", "   ")).toBeUndefined();
  });

  it("does not CC the recipient on their own email, whatever the casing", () => {
    expect(resolveCc("accounts@thethatelecom.co.za", "accounts@thethatelecom.co.za")).toBeUndefined();
    expect(resolveCc("Accounts@TheThaTelecom.co.za", "accounts@thethatelecom.co.za")).toBeUndefined();
    expect(resolveCc(" accounts@thethatelecom.co.za ", "accounts@thethatelecom.co.za")).toBeUndefined();
  });
});
