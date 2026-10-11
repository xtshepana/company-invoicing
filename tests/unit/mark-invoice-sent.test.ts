import { beforeEach, describe, expect, it, vi } from "vitest";

// invoice-actions.ts pulls in the PDF renderer, e-mail and Supabase clients; none of that is needed to test this action,
// so every collaborator is replaced and the test asserts what it did to them.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
const requireModuleAccess = vi.fn();
vi.mock("@/server/services/auth", () => ({ requireModuleAccess: (m: string) => requireModuleAccess(m) }));
const recordAuditLog = vi.fn();
vi.mock("@/server/services/audit", () => ({ recordAuditLog: (e: unknown) => recordAuditLog(e) }));
const sendEmail = vi.fn();
vi.mock("@/server/services/email", () => ({ sendEmail: (p: unknown) => sendEmail(p) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: vi.fn() }));
vi.mock("@/lib/config/system-settings", () => ({ getCompanySettings: vi.fn() }));
vi.mock("@/lib/pdf/render-invoice", () => ({ renderInvoicePdf: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ invoiceSentEmail: vi.fn(), paymentReminderEmail: vi.fn() }));

// A minimal stand-in for the Supabase query builder: select().eq().single() reads the invoice,
// update().eq().eq().select() reports how many rows changed.
const state = {
  invoice: { status: "draft" } as { status: string } | null,
  fetchError: null as unknown,
  updateError: null as unknown,
  updatedRows: [{ id: "inv-1" }] as { id: string }[],
  updates: [] as unknown[],
};
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: state.invoice, error: state.fetchError }) }) }),
      update: (values: unknown) => {
        state.updates.push(values);
        return { eq: () => ({ eq: () => ({ select: async () => ({ data: state.updatedRows, error: state.updateError }) }) }) };
      },
    }),
  }),
}));

import { markInvoiceSentAction } from "@/server/actions/invoice-actions";

function form(id?: string): FormData {
  const f = new FormData();
  if (id !== undefined) f.set("id", id);
  return f;
}

beforeEach(() => {
  state.invoice = { status: "draft" };
  state.fetchError = null;
  state.updateError = null;
  state.updatedRows = [{ id: "inv-1" }];
  state.updates = [];
  revalidatePath.mockReset();
  requireModuleAccess.mockReset().mockResolvedValue({ id: "user-1" });
  recordAuditLog.mockReset();
  sendEmail.mockReset();
});

describe("markInvoiceSentAction", () => {
  it("marks a draft invoice as sent, records it, and never sends an email", async () => {
    const result = await markInvoiceSentAction({}, form("inv-1"));

    expect(result).toEqual({ success: true });
    expect(requireModuleAccess).toHaveBeenCalledWith("invoices");
    expect(state.updates).toEqual([{ status: "sent" }]);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", action: "invoice.marked_sent", entity: "invoices", entityId: "inv-1", newValue: { emailed: false } })
    );
    expect(sendEmail).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/invoices/inv-1");
  });

  it("does not need the customer to have an email address", async () => {
    // the fake invoice row has no customers join at all
    expect(await markInvoiceSentAction({}, form("inv-1"))).toEqual({ success: true });
  });

  it.each(["sent", "partially_paid", "paid", "cancelled", "void"])("refuses an invoice that is already %s", async (status) => {
    state.invoice = { status };
    const result = await markInvoiceSentAction({}, form("inv-1"));

    expect(result.error).toMatch(/only draft/i);
    expect(state.updates).toEqual([]);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("reports a missing id and a missing invoice", async () => {
    expect((await markInvoiceSentAction({}, form())).error).toMatch(/missing invoice/i);
    state.invoice = null;
    expect((await markInvoiceSentAction({}, form("nope"))).error).toMatch(/not found/i);
    expect(state.updates).toEqual([]);
  });

  it("reports a change made by someone else instead of overwriting it (zero rows updated)", async () => {
    state.updatedRows = [];
    const result = await markInvoiceSentAction({}, form("inv-1"));

    expect(result.error).toMatch(/changed by someone else/i);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the update fails", async () => {
    state.updateError = { message: "boom" };
    const result = await markInvoiceSentAction({}, form("inv-1"));

    expect(result.error).toMatch(/unable to update/i);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("stops before touching anything when the caller lacks invoices access", async () => {
    requireModuleAccess.mockRejectedValue(new Error("forbidden"));
    await expect(markInvoiceSentAction({}, form("inv-1"))).rejects.toThrow("forbidden");
    expect(state.updates).toEqual([]);
  });
});
