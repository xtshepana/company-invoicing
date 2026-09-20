import { test, expect } from "@playwright/test";

test("VAT and aging reports render and export CSV", async ({ page }) => {
  await test.step("reports index links to both reports", async () => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    // The two report cards' titles are shadcn CardTitle elements (plain
    // divs, not <h2>/<h3>), so they have no "heading" role to query by.
    await expect(page.getByText("VAT Report", { exact: true })).toBeVisible();
    await expect(page.getByText("Accounts Receivable Aging", { exact: true })).toBeVisible();
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
});
