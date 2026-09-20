import { test, expect } from "@playwright/test";

/**
 * The build spec names this explicitly under Testing: "Verify Staff
 * cannot perform restricted accounting/admin actions." tests/unit/
 * permissions.test.ts already covers hasModuleAccess() directly and
 * fast, but that only proves the function itself is correct — it says
 * nothing about whether every page actually calls it. This runs as a
 * genuinely restricted staff login (role "staff", staff_module_permissions
 * = {"customers": true} only — see scripts/create-e2e-user.mjs and
 * playwright.config.ts's "chromium-staff" project) and checks the real
 * redirects, not the underlying logic a second time.
 */
test.describe("a staff member with only Customers enabled", () => {
  test("can reach the module they were granted", async ({ page }) => {
    await page.goto("/customers");
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  });

  test("is redirected away from Invoices, a module-gated page they weren't granted", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("is redirected away from Payments, another module-gated page they weren't granted", async ({ page }) => {
    await page.goto("/payments");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("is redirected away from Reports", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("is redirected away from Users, an owner_admin-only page", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("is redirected away from Settings, an owner_admin-only page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("is redirected away from the Audit Log, an owner_admin-only page", async ({ page }) => {
    await page.goto("/audit-log");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
