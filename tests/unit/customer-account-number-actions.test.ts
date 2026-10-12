import { beforeEach, describe, expect, it, vi } from "vitest";

// The server - not the form - decides a customer's account number. The field is only read-only in the browser, so
// these tests post a hand-crafted value and check it is ignored.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/auth", () => ({ requireModuleAccess: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/server/services/audit", () => ({ recordAuditLog: vi.fn() }));

const state = {
  existing: { id: "cust-1", company_name: "Baloyi Katlego Attorneys", customer_reference: "BAL007" } as Record<string, unknown> | null,
  generated: "NEW001",
  insertError: null as { code?: string } | null,
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  rpcCalls: [] as { fn: string; args: unknown }[],
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: state.generated, error: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: state.existing, error: null }) }) }),
      insert: (row: Record<string, unknown>) => {
        state.inserts.push(row);
        return { select: () => ({ single: async () => ({ data: state.insertError ? null : { id: "cust-new" }, error: state.insertError }) }) };
      },
      update: (row: Record<string, unknown>) => {
        state.updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { createCustomerAction, updateCustomerAction } from "@/server/actions/customer-actions";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  data.set("customer_type", "business");
  data.set("company_name", "Baloyi Katlego Attorneys");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  state.existing = { id: "cust-1", company_name: "Baloyi Katlego Attorneys", customer_reference: "BAL007" };
  state.generated = "NEW001";
  state.insertError = null;
  state.inserts = [];
  state.updates = [];
  state.rpcCalls = [];
});

describe("createCustomerAction", () => {
  it("always uses the generated account number", async () => {
    await createCustomerAction({}, form({}));

    expect(state.rpcCalls).toEqual([{ fn: "next_customer_account_number", args: { p_company_name: "Baloyi Katlego Attorneys" } }]);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0].customer_reference).toBe("NEW001");
  });

  it("ignores an account number posted with the form, so a customer can never be given another customer's number", async () => {
    await createCustomerAction({}, form({ customer_reference: "MAL036" }));

    expect(state.inserts[0].customer_reference).toBe("NEW001");
    expect(state.rpcCalls).toHaveLength(1);
  });

  it("reports an account-number clash as a retryable error", async () => {
    state.insertError = { code: "23505" };
    const result = await createCustomerAction({}, form({}));

    expect(result?.error).toMatch(/account number is already in use/i);
  });
});

describe("updateCustomerAction", () => {
  it("keeps the existing account number when the form posts the same one", async () => {
    await updateCustomerAction({}, form({ id: "cust-1", customer_reference: "BAL007", phone: "0110000000" }));

    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].customer_reference).toBe("BAL007");
    expect(state.updates[0].phone).toBe("0110000000");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("ignores a different account number posted with the form", async () => {
    await updateCustomerAction({}, form({ id: "cust-1", customer_reference: "MAL036" }));

    expect(state.updates[0].customer_reference).toBe("BAL007");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("ignores a blank account number posted with the form instead of issuing a new one", async () => {
    await updateCustomerAction({}, form({ id: "cust-1", customer_reference: "" }));

    expect(state.updates[0].customer_reference).toBe("BAL007");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("does not change the account number when the company name changes", async () => {
    await updateCustomerAction({}, form({ id: "cust-1", company_name: "Totally Different Name Inc" }));

    expect(state.updates[0].customer_reference).toBe("BAL007");
  });

  it("generates one only for a customer that has none yet", async () => {
    state.existing = { id: "cust-1", company_name: "Old", customer_reference: "" };
    await updateCustomerAction({}, form({ id: "cust-1" }));

    expect(state.updates[0].customer_reference).toBe("NEW001");
    expect(state.rpcCalls).toHaveLength(1);
  });

  it("refuses to update a customer that does not exist", async () => {
    state.existing = null;
    const result = await updateCustomerAction({}, form({ id: "missing" }));

    expect(result?.error).toMatch(/not found/i);
    expect(state.updates).toHaveLength(0);
  });
});
