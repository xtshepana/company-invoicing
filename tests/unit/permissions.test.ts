import { describe, expect, it, vi } from "vitest";

// hasModuleAccess() doesn't touch Supabase itself, but importing
// server/services/auth.ts pulls in lib/supabase/server.ts (which imports
// "server-only" and next/headers) purely as a side effect of the module
// graph — neither is safe to execute outside a real Next.js request, so
// both are stubbed rather than exercised.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const { hasModuleAccess } = await import("@/server/services/auth");
import type { Profile } from "@/server/services/auth";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "user@example.com",
    full_name: "Test User",
    role: "staff",
    is_active: true,
    staff_module_permissions: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("hasModuleAccess", () => {
  it("grants owner_admin every module regardless of staff_module_permissions", () => {
    const admin = makeProfile({ role: "owner_admin", staff_module_permissions: null });
    for (const mod of ["customers", "invoices", "payments", "banking", "reports"] as const) {
      expect(hasModuleAccess(admin, mod)).toBe(true);
    }
  });

  it("grants accountant every module regardless of staff_module_permissions", () => {
    const accountant = makeProfile({ role: "accountant", staff_module_permissions: {} });
    for (const mod of ["customers", "invoices", "payments", "banking", "reports"] as const) {
      expect(hasModuleAccess(accountant, mod)).toBe(true);
    }
  });

  it("denies a staff member every module when staff_module_permissions is null", () => {
    const staff = makeProfile({ role: "staff", staff_module_permissions: null });
    for (const mod of ["customers", "invoices", "payments", "banking", "reports"] as const) {
      expect(hasModuleAccess(staff, mod)).toBe(false);
    }
  });

  it("denies a staff member every module when staff_module_permissions is an empty object", () => {
    const staff = makeProfile({ role: "staff", staff_module_permissions: {} });
    expect(hasModuleAccess(staff, "invoices")).toBe(false);
    expect(hasModuleAccess(staff, "payments")).toBe(false);
  });

  it("grants a staff member only the modules explicitly enabled — this is the restriction the whole app relies on", () => {
    const staff = makeProfile({
      role: "staff",
      staff_module_permissions: { customers: true, invoices: true, payments: false },
    });
    expect(hasModuleAccess(staff, "customers")).toBe(true);
    expect(hasModuleAccess(staff, "invoices")).toBe(true);
    // Explicitly false and simply absent must both deny — a staff member
    // must never fall back to "allowed" for an accounting/admin module
    // they weren't given, whether that's because someone set it to false
    // or because it was never granted at all.
    expect(hasModuleAccess(staff, "payments")).toBe(false);
    expect(hasModuleAccess(staff, "banking")).toBe(false);
    expect(hasModuleAccess(staff, "reports")).toBe(false);
  });

  it("ignores unrelated profile fields — only role and staff_module_permissions decide access", () => {
    // hasModuleAccess takes the whole Profile object; this pins down that
    // changing name/email/id has no bearing on the result, only the two
    // fields the function actually reads.
    const staff = makeProfile({
      role: "staff",
      staff_module_permissions: { invoices: true },
      full_name: "Ignore Me",
      email: "ignore@example.com",
    });
    expect(hasModuleAccess(staff, "invoices")).toBe(true);
    expect(hasModuleAccess(staff, "payments")).toBe(false);
  });
});
