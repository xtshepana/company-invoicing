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

/**
 * The build spec names this explicitly as a critical scenario: generate,
 * run generation again, confirm no duplicate. There's no manual "Generate
 * Now" button in the UI — generation only happens via the daily cron
 * (app/api/cron/daily) — so this hits that endpoint directly with the
 * real CRON_SECRET (loaded into process.env by playwright.config.ts's
 * loadDotEnvLocal(), same as E2E_USER_EMAIL/PASSWORD) rather than going
 * through a page. auto_generate defaults to true and auto_send_email
 * defaults to false on a new recurring invoice, and "Start date" defaults
 * to today, so a freshly created one is immediately due — no need to
 * backdate anything.
 */
test("running the daily cron twice never generates a duplicate invoice", async ({ page, request }) => {
  const runId = Date.now();
  const customerName = `E2E Idempotent Co ${runId}`;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET must be set in .env.local to run this test.");

  await test.step("create a customer", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Company name").fill(customerName);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  });

  await test.step("create a monthly recurring invoice starting today", async () => {
    await page.goto("/recurring-invoices/new");
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();
    await page.getByLabel("Description").fill(`E2E idempotency test ${runId}`);

    const table = page.locator("table").first();
    await table.getByPlaceholder("Description").fill("E2E monthly service");
    const numberInputs = table.locator('tbody input[type="number"]');
    await numberInputs.nth(1).fill("500"); // unit price

    await page.getByRole("button", { name: "Create recurring invoice" }).click();
    await expect(page).toHaveURL(/\/recurring-invoices\/[0-9a-f-]+$/);
  });

  const recurringUrl = page.url();
  const generatedInvoicesTable = () => page.getByText("Generated invoices").locator("xpath=../..").locator("tbody tr");

  await test.step("before any cron run, no invoices have been generated", async () => {
    await expect(page.getByText("No invoices generated yet.")).toBeVisible();
  });

  await test.step("run the daily cron once — it generates exactly one invoice", async () => {
    const res = await request.get("/api/cron/daily", { headers: { Authorization: `Bearer ${cronSecret}` } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.recurringInvoices.generated).toBeGreaterThanOrEqual(1);

    await page.goto(recurringUrl);
    await expect(page.getByText("Never")).toHaveCount(0); // "Last generated" is no longer "Never"
    await expect(generatedInvoicesTable()).toHaveCount(1);
  });

  await test.step("run the daily cron again — it must not create a second invoice", async () => {
    const res = await request.get("/api/cron/daily", { headers: { Authorization: `Bearer ${cronSecret}` } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // This run's due window no longer includes our recurring invoice
    // (next_invoice_date has already moved forward a month), so it
    // shouldn't even be counted as "already_generated" here — the real
    // assertion is the row count below staying at exactly one.
    expect(body.recurringInvoices.errors).toEqual([]);

    await page.goto(recurringUrl);
    await expect(generatedInvoicesTable()).toHaveCount(1);
  });
});
