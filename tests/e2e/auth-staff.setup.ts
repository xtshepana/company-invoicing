import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/staff.json";

/**
 * A second, genuinely-restricted staff login — role "staff" with only
 * {"customers": true} in staff_module_permissions (see
 * scripts/create-e2e-user.mjs and CLAUDE.md's "e2e tests" section for how
 * this account was bootstrapped). Kept separate from the owner_admin
 * storageState in auth.setup.ts so staff-permissions.spec.ts can verify
 * what a restricted user actually can't reach, not what an admin can.
 */
setup("authenticate as a restricted staff user", async ({ page }) => {
  const email = process.env.E2E_STAFF_EMAIL;
  const password = process.env.E2E_STAFF_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD are not set. Run `node scripts/create-e2e-user.mjs STAFF` and set them in .env.local first."
    );
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
