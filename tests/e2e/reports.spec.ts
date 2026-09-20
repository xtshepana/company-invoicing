import { test, expect } from "@playwright/test";

test("VAT and aging reports render and export CSV", async ({ page }) => {
  await test.step("reports index links to all four reports", async () => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(page.getByText("Sales & Income Report", { exact: true })).toBeVisible();
    await expect(page.getByText("VAT Report", { exact: true })).toBeVisible();
    await expect(page.getByText("Accounts Receivable Aging", { exact: true })).toBeVisible();
    await expect(page.getByText("Bank Reconciliation Report", { exact: true })).toBeVisible();
  });

  await test.step("VAT report renders with summary figures and exports CSV", async () => {
    await page.goto("/reports/vat");
    await expect(page.getByText("Sales (excl. VAT)")).toBeVisible();
    await expect(page.getByText("Net VAT payable")).toBeVisible();

    // role="button" — Base UI's Button always reports role="button" even
    // rendered as <a render={...}>, regardless of the underlying tag.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^vat-report-.*\.csv$/);
  });

  await test.step("aging report renders (with data or the empty state) and exports CSV", async () => {
    await page.goto("/reports/aging");
    await expect(
      page.getByRole("columnheader", { name: "90+ days" }).or(page.getByText("No outstanding invoices"))
    ).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^aging-report-.*\.csv$/);
  });

  await test.step("sales & income report renders with summary figures and exports CSV", async () => {
    await page.goto("/reports/sales");
    await expect(page.getByText("Sales (excl. VAT)")).toBeVisible();
    await expect(page.getByText("Income (payments received)")).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^sales-report-.*\.csv$/);
  });

  await test.step("bank reconciliation report renders with summary cards and exports CSV", async () => {
    await page.goto("/reports/bank-reconciliation");
    // The Matched/Unmatched/Ignored summary cards always render, even
    // with zero bank_transactions rows — only the "Transactions in
    // period" table below them is conditional on data existing.
    await expect(page.getByText("Matched", { exact: true })).toBeVisible();
    await expect(page.getByText("Unmatched", { exact: true })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^bank-reconciliation-report-.*\.csv$/);
  });
});
