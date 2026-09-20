import { test, expect } from "@playwright/test";

test("recurring invoice lifecycle: create, skip, pause, resume, cancel", async ({ page }) => {
  const runId = Date.now();
  const customerName = `E2E Recurring Co ${runId}`;

  await test.step("create a customer for this recurring invoice", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Company name").fill(customerName);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  });

  await test.step("create a monthly recurring invoice", async () => {
    await page.goto("/recurring-invoices/new");
    // exact: true — "Customer" would otherwise substring-match the
    // "Automatically email the customer" switch's label too.
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();
    await page.getByLabel("Description").fill(`E2E recurring service ${runId}`);

    const table = page.locator("table").first();
    await table.getByPlaceholder("Description").fill("E2E monthly service");
    const numberInputs = table.locator('tbody input[type="number"]');
    await numberInputs.nth(1).fill("200"); // unit price

    await page.getByRole("button", { name: "Create recurring invoice" }).click();
    await expect(page).toHaveURL(/\/recurring-invoices\/[0-9a-f-]+$/);
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
  });

  await test.step("skip the next occurrence", async () => {
    // "Next invoice date" (the CardTitle) and the date itself (CardContent)
    // are siblings under the same Card, not parent/child — go up two
    // levels from the label to reach the card that contains both.
    const nextDateCard = page.getByText("Next invoice date").locator("xpath=../..");
    const nextDateBefore = await nextDateCard.textContent();
    await page.getByRole("button", { name: "Skip Next" }).click();
    await expect(nextDateCard).not.toHaveText(nextDateBefore ?? "");
  });

  await test.step("pause it", async () => {
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Paused", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip Next" })).toHaveCount(0);
  });

  await test.step("resume it", async () => {
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
  });

  await test.step("cancel it", async () => {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });
});
