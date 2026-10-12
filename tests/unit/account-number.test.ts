import { describe, expect, it } from "vitest";
import {
  ACCOUNT_NUMBER_PATTERN,
  customerOptionLabel,
  findQuotedAccountNumbers,
  genericNameWords,
  nameAppearsIn,
  significantNameWords,
} from "@/lib/customers/account-number";

describe("ACCOUNT_NUMBER_PATTERN", () => {
  it("accepts the generated shape: 3 capital letters and at least 3 digits", () => {
    for (const ok of ["ABC001", "BAL007", "ZIY068", "ABC1000"]) expect(ACCOUNT_NUMBER_PATTERN.test(ok), ok).toBe(true);
  });

  it("rejects anything else, including lower case, spaces and short numbers", () => {
    for (const bad of ["abc001", "ABC01", "AB001", "ABCD001", "ABC 001", " ABC001", "ABC001 ", "ABC-001", "123456", ""]) {
      expect(ACCOUNT_NUMBER_PATTERN.test(bad), bad).toBe(false);
    }
  });
});

describe("customerOptionLabel", () => {
  it("shows the account number next to the name, so similarly named customers can be told apart", () => {
    expect(customerOptionLabel({ company_name: "Baloyi Katlego Attorneys", customer_reference: "BAL007" })).toBe("Baloyi Katlego Attorneys (BAL007)");
    expect(customerOptionLabel({ company_name: "Baloyi TS & Morobe Inc", customer_reference: "BAL008" })).toBe("Baloyi TS & Morobe Inc (BAL008)");
  });

  it("shows just the name when there is no account number", () => {
    expect(customerOptionLabel({ company_name: "Acme" })).toBe("Acme");
    expect(customerOptionLabel({ company_name: "Acme", customer_reference: "" })).toBe("Acme");
    expect(customerOptionLabel({ company_name: "Acme", customer_reference: null })).toBe("Acme");
  });
});

describe("findQuotedAccountNumbers", () => {
  const refs = ["BAL007", "BAL008", "MAL036", "KAT003"];

  it("finds an account number quoted in a bank description, whatever the case or punctuation", () => {
    expect(findQuotedAccountNumbers("PAYMENT BAL007 OCT", refs)).toEqual(new Set(["BAL007"]));
    expect(findQuotedAccountNumbers("ref:bal008", refs)).toEqual(new Set(["BAL008"]));
    expect(findQuotedAccountNumbers("FNB TRANSFER (MAL036)", refs)).toEqual(new Set(["MAL036"]));
    expect(findQuotedAccountNumbers("BAL007", refs)).toEqual(new Set(["BAL007"]));
  });

  it("finds more than one when the payer quotes more than one", () => {
    expect(findQuotedAccountNumbers("BAL007 BAL008 INV 12", refs)).toEqual(new Set(["BAL007", "BAL008"]));
  });

  it("does not treat part of a longer code as an account number", () => {
    expect(findQuotedAccountNumbers("BAL0071", refs).size).toBe(0);
    expect(findQuotedAccountNumbers("XBAL007", refs).size).toBe(0);
    expect(findQuotedAccountNumbers("INVBAL007PAID", refs).size).toBe(0);
  });

  it("finds nothing in an ordinary description, and ignores blank references", () => {
    expect(findQuotedAccountNumbers("ABSA EFT PAYMENT FROM SOMEONE", refs).size).toBe(0);
    expect(findQuotedAccountNumbers("anything", ["", "BAL007"]).size).toBe(0);
  });
});

describe("name matching that does not confuse customers", () => {
  // like a firm whose clients are mostly attorneys
  const names = [
    "Baloyi Katlego Attorneys",
    "Chabalala M Attorneys",
    "Davhana N Attorneys",
    "Fatola Attorneys",
    "Motsepe Attorneys",
    "Maluleke Dzebu Attorneys Inc",
    "Maluleke HN Attorneys",
    "Hlulani Maluleke",
    "Kichose Motors",
  ];
  const generic = genericNameWords(names);

  it("keeps the words of a name that say who it is, dropping short words and company suffixes", () => {
    expect(significantNameWords("Maluleke HN Attorneys (Pty) Ltd")).toEqual(["maluleke", "attorneys"]);
  });

  it("treats a word shared by many customers as generic, and a word shared by a few as distinguishing", () => {
    expect(generic.has("attorneys")).toBe(true);
    expect(generic.has("maluleke")).toBe(false);
    expect(generic.has("kichose")).toBe(false);
  });

  it("no longer matches every Attorneys customer when the bank line only says 'attorneys'", () => {
    const line = "TRUST ACCOUNT ATTORNEYS PAYMENT";
    expect(nameAppearsIn("Chabalala M Attorneys", line)).toBe(true); // the old behaviour: matches all of them
    for (const name of names.slice(0, 6)) expect(nameAppearsIn(name, line, generic), name).toBe(false);
  });

  it("still matches on a word that distinguishes the customer", () => {
    expect(nameAppearsIn("Chabalala M Attorneys", "CHABALALA ATTORNEYS", generic)).toBe(true);
    expect(nameAppearsIn("Kichose Motors", "KICHOSE", generic)).toBe(true);
    expect(nameAppearsIn("Kichose Motors", "SOMEONE ELSE", generic)).toBe(false);
  });

  it("cannot identify a customer whose name is only generic words", () => {
    const allGeneric = genericNameWords(["A Attorneys", "B Attorneys", "C Attorneys", "D Attorneys", "E Attorneys"]);
    expect(nameAppearsIn("Attorneys Inc", "PAYMENT ATTORNEYS", allGeneric)).toBe(false);
  });
});
