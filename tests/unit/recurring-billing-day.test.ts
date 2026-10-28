import { beforeEach, describe, expect, it, vi } from "vitest";

// A new recurring invoice starts on the company's billing day (the 26th), whatever start date was picked.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/services/auth", () => ({ requireModuleAccess: vi.fn(async () => ({ id: "user-1" })) }));
vi.mock("@/server/services/audit", () => ({ recordAuditLog: vi.fn() }));

const state = { billingDay: 26 as number | null, rpcCalls: [] as { fn: string; args: Record<string, unknown> }[] };
vi.mock("@/lib/config/system-settings", () => ({ getCompanySettings: async () => ({ recurring_billing_day: state.billingDay }) }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args });
      return { data: "new-recurring-id", error: null };
    },
  }),
}));

import { createRecurringInvoiceAction } from "@/server/actions/recurring-invoice-actions";

function form(over: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    customer_id: "00000000-0000-4000-8000-000000000001",
    description: "Monthly service",
    frequency: "monthly",
    start_date: "2026-11-10",
    line_items: JSON.stringify([{ description: "Service", quantity: 1, unit_price: 100, discount_percent: 0, vat_rate: 0 }]),
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  state.billingDay = 26;
  state.rpcCalls = [];
});

describe("createRecurringInvoiceAction and the billing day", () => {
  it("moves a start date before the 26th to the 26th", async () => {
    await createRecurringInvoiceAction({}, form({ start_date: "2026-11-10" }));
    expect(state.rpcCalls[0].fn).toBe("create_recurring_invoice");
    expect(state.rpcCalls[0].args.p_start_date).toBe("2026-11-26");
  });

  it("moves a start date after the 26th to the 26th of the next month", async () => {
    await createRecurringInvoiceAction({}, form({ start_date: "2026-10-28" }));
    expect(state.rpcCalls[0].args.p_start_date).toBe("2026-11-26");
  });

  it("keeps a start date that is already the 26th", async () => {
    await createRecurringInvoiceAction({}, form({ start_date: "2026-11-26" }));
    expect(state.rpcCalls[0].args.p_start_date).toBe("2026-11-26");
  });

  it("applies to quarterly and yearly schedules too", async () => {
    await createRecurringInvoiceAction({}, form({ frequency: "quarterly", start_date: "2026-12-02" }));
    await createRecurringInvoiceAction({}, form({ frequency: "annually", start_date: "2026-12-30" }));
    expect(state.rpcCalls.map((call) => call.args.p_start_date)).toEqual(["2026-12-26", "2027-01-26"]);
  });

  it("leaves weekly and custom-day schedules on the date that was picked", async () => {
    await createRecurringInvoiceAction({}, form({ frequency: "weekly", start_date: "2026-11-10" }));
    await createRecurringInvoiceAction({}, form({ frequency: "custom", custom_interval_days: "10", start_date: "2026-11-11" }));
    expect(state.rpcCalls.map((call) => call.args.p_start_date)).toEqual(["2026-11-10", "2026-11-11"]);
  });

  it("changes nothing when the company has no billing day", async () => {
    state.billingDay = null;
    await createRecurringInvoiceAction({}, form({ start_date: "2026-11-10" }));
    expect(state.rpcCalls[0].args.p_start_date).toBe("2026-11-10");
  });

  it("rejects a start date that is not a real date without saving anything", async () => {
    const result = await createRecurringInvoiceAction({}, form({ start_date: "10/11/2026" }));

    expect(result?.error).toMatch(/valid start date/i);
    expect(state.rpcCalls).toEqual([]);
  });
});
