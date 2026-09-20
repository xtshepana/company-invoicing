import { test, expect } from "@playwright/test";

/**
 * The acceptance-test golden path: customer -> invoice -> mark sent ->
 * record payment -> paid -> credit note -> issued -> credit balance ->
 * statement. One long test with steps, not several independent tests,
 * because each stage genuinely depends on state the previous one created
 * (the invoice ID, the customer's credit balance) — splitting it up would
 * just mean re-deriving that state instead of testing the real flow.
 *
 * Uses a uniquely-named customer per run so this never touches the
 * curated "ABC Technologies" demo fixtures other tests/manual QA rely on.
 */
test("customer through invoice, payment, and credit note", async ({ page }) => {
  const runId = Date.now();
  const customerName = `E2E Customer ${runId}`;

  await test.step("create a customer", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Company name").fill(customerName);
    await page.getByLabel("Email").fill(`e2e+${runId}@example.com`);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
  });

  const customerUrl = page.url();

  await test.step("create an invoice for that customer", async () => {
    await page.goto("/invoices/new");
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();

    const table = page.locator("table").first();
    await table.getByPlaceholder("Description").fill("E2E consulting services");
    const numberInputs = table.locator('tbody input[type="number"]');
    await numberInputs.nth(1).fill("1000"); // unit price

    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
    await expect(page.getByText("R 1 150,00").first()).toBeVisible(); // 1000 + 15% VAT
  });

  const invoiceUrl = page.url();

  // "Mark as Sent" / "Record payment" / "Issue" each chain several
  // sequential Supabase round trips server-side plus a PDF render and an
  // email-log write (see invoice-actions.ts / payment-actions.ts /
  // credit-note-actions.ts) before responding — comfortably under a
  // second locally, but slow enough over a real network to a hosted
  // Supabase project to need more than the suite's default 10s.
  const SLOW_ACTION_TIMEOUT = 20_000;

  await test.step("mark the invoice as sent", async () => {
    await page.getByRole("button", { name: "Mark as Sent" }).click();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible({ timeout: SLOW_ACTION_TIMEOUT });
  });

  await test.step("record a full payment against it", async () => {
    await page.getByRole("button", { name: "Record Payment" }).click();
    await expect(page).toHaveURL(/\/payments\/new/);

    // The customer is already selected via the ?customer= prefill from the invoice page.
    await page.getByLabel("Amount").fill("1150");
    // Allocation is opt-in — nothing auto-allocates to the invoice without this.
    await page.getByRole("button", { name: "Auto-allocate (oldest first)" }).click();
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/, { timeout: SLOW_ACTION_TIMEOUT });
  });

  await test.step("the invoice now shows fully paid", async () => {
    await page.goto(invoiceUrl);
    // "Paid" also matches the "Paid" amount stat card's own label, not just the status badge.
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R 0,00").first()).toBeVisible(); // outstanding
  });

  await test.step("create a credit note against the invoice", async () => {
    await page.getByRole("button", { name: "Create Credit Note" }).click();
    await expect(page).toHaveURL(/\/credit-notes\/new/);

    const table = page.locator("table").first();
    await table.getByPlaceholder("Description").fill("E2E partial return");
    const numberInputs = table.locator('tbody input[type="number"]');
    await numberInputs.nth(1).fill("100"); // unit price

    await page.getByRole("button", { name: "Create credit note" }).click();
    await expect(page).toHaveURL(/\/credit-notes\/[0-9a-f-]+$/);
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  });

  await test.step("issue the credit note", async () => {
    await page.getByRole("button", { name: "Issue", exact: true }).click();
    await page.getByRole("button", { name: "Issue credit note" }).click();
    await expect(page.getByText("Issued", { exact: true })).toBeVisible({ timeout: SLOW_ACTION_TIMEOUT });
  });

  await test.step("the customer's credit balance reflects it", async () => {
    await page.goto(customerUrl);
    await expect(page.getByText("R 115,00").first()).toBeVisible(); // 100 + 15% VAT
  });

  await test.step("create a second invoice to apply that credit against", async () => {
    await page.goto("/invoices/new");
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();

    const table = page.locator("table").first();
    await table.getByPlaceholder("Description").fill("E2E second invoice");
    const numberInputs = table.locator('tbody input[type="number"]');
    await numberInputs.nth(1).fill("50"); // 50 + 15% VAT = 57.50, well under the R115 credit available

    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  });

  await test.step("apply the customer credit to it — apply_customer_credit() has no other test coverage", async () => {
    await page.getByRole("button", { name: "Apply Credit", exact: true }).click();
    // The dialog defaults the amount to min(credit available, invoice
    // balance) = R57.50, which fully settles this invoice.
    await page.getByRole("button", { name: "Apply credit", exact: true }).click();
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible({ timeout: SLOW_ACTION_TIMEOUT });
    await expect(page.getByText("R 0,00").first()).toBeVisible();
  });

  await test.step("the customer's credit balance decreased by exactly the amount applied", async () => {
    await page.goto(customerUrl);
    await expect(page.getByText("R 57,50").first()).toBeVisible(); // 115.00 - 57.50
  });

  await test.step("the customer statement renders", async () => {
    // role="button" again — same Base UI Button-rendered-as-Link pattern as "Export CSV"/"Go to Reconciliation".
    await page.getByRole("button", { name: "Statement" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+\/statement$/);
    await expect(page.getByText(customerName).first()).toBeVisible();
  });
});
