import { test, expect } from "@playwright/test";

/**
 * Two payment-allocation scenarios the build spec names explicitly and
 * core-workflow.spec.ts doesn't cover (that one only exercises a single
 * full payment against a single invoice): splitting one payment across
 * multiple invoices, and an overpayment that becomes customer credit
 * rather than being rejected or lost.
 *
 * Each test uses its own uniquely-named customer, same convention as
 * core-workflow.spec.ts, so this never touches the curated
 * "ABC Technologies" fixture.
 */

const SLOW_ACTION_TIMEOUT = 20_000;

async function createInvoice(page: import("@playwright/test").Page, customerName: string, unitPrice: string) {
  await page.goto("/invoices/new");
  await page.getByLabel("Customer", { exact: true }).click();
  await page.getByRole("option", { name: customerName }).click();

  const table = page.locator("table").first();
  await table.getByPlaceholder("Description").fill(`E2E line ${unitPrice}`);
  const numberInputs = table.locator('tbody input[type="number"]');
  await numberInputs.nth(1).fill(unitPrice);

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  return page.url();
}

test("one payment split across two invoices marks both fully paid", async ({ page }) => {
  const runId = Date.now();
  const customerName = `E2E Split ${runId}`;

  await test.step("create a customer", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Company name").fill(customerName);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  });

  // 2000 + 15% VAT = 2300; 3000 + 15% VAT = 3450; combined = 5750.
  const invoiceAUrl = await test.step("create invoice A (R2,300 incl. VAT)", () => createInvoice(page, customerName, "2000"));
  const invoiceBUrl = await test.step("create invoice B (R3,450 incl. VAT)", () => createInvoice(page, customerName, "3000"));

  await test.step("record one R5,750 payment and auto-allocate across both", async () => {
    await page.goto("/payments/new");
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();
    await page.getByLabel("Amount").fill("5750");
    await page.getByRole("button", { name: "Auto-allocate (oldest first)" }).click();
    // Auto-allocate walks invoices oldest-due-first and stops once the
    // payment is exhausted — with the payment exactly equal to both
    // invoices' combined total, both should be fully allocated with
    // nothing left over for customer credit.
    await expect(page.getByText("To customer credit")).toBeVisible();
    await expect(page.getByText("R 0,00").last()).toBeVisible();
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/, { timeout: SLOW_ACTION_TIMEOUT });
  });

  await test.step("invoice A shows fully paid", async () => {
    await page.goto(invoiceAUrl);
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R 0,00").first()).toBeVisible();
  });

  await test.step("invoice B shows fully paid", async () => {
    await page.goto(invoiceBUrl);
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R 0,00").first()).toBeVisible();
  });
});

test("an overpayment fully pays the invoice and the remainder becomes customer credit", async ({ page }) => {
  const runId = Date.now();
  const customerName = `E2E Overpay ${runId}`;

  await test.step("create a customer", async () => {
    await page.goto("/customers/new");
    await page.getByLabel("Company name").fill(customerName);
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  });

  const customerUrl = page.url();
  // 1000 + 15% VAT = 1150.
  const invoiceUrl = await test.step("create an invoice for R1,150 incl. VAT", () => createInvoice(page, customerName, "1000"));

  await test.step("record a R1,500 payment — R350 more than the invoice", async () => {
    await page.goto("/payments/new");
    await page.getByLabel("Customer", { exact: true }).click();
    await page.getByRole("option", { name: customerName }).click();
    await page.getByLabel("Amount").fill("1500");
    await page.getByRole("button", { name: "Auto-allocate (oldest first)" }).click();
    // Auto-allocate covers the invoice's full R1,150 balance and leaves
    // the R350 remainder unallocated — that's what record_payment() turns
    // into a customer_credits row, not a rejected or floored payment.
    await expect(page.getByText("R 350,00").last()).toBeVisible();
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(page).toHaveURL(/\/payments\/[0-9a-f-]+$/, { timeout: SLOW_ACTION_TIMEOUT });
  });

  await test.step("the invoice shows fully paid", async () => {
    await page.goto(invoiceUrl);
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("R 0,00").first()).toBeVisible();
  });

  await test.step("the customer's credit balance shows the R350 overpayment", async () => {
    await page.goto(customerUrl);
    await expect(page.getByText("R 350,00").first()).toBeVisible();
  });
});
