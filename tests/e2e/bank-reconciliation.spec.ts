import { test, expect } from "@playwright/test";

test("import a bank statement and work an unmatched transaction through ignore/restore", async ({ page }) => {
  const runId = Date.now();
  const reference = `E2ETXN${runId}`;
  const today = new Date().toISOString().slice(0, 10); // matches the wizard's default "YYYY-MM-DD" date format — no need to change it

  await test.step("upload a CSV statement", async () => {
    await page.goto("/bank-reconciliation/import");
    const csv = `Date,Description,Amount,Reference\n${today},E2E test deposit,321.55,${reference}\n`;
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    // "Map columns" / "Import complete" are shadcn CardTitle elements
    // (plain divs, not real headings) — query by text, not role.
    await expect(page.getByText("Map columns", { exact: true })).toBeVisible();
    // The wizard guesses column roles from the headers — Date/Description/Amount/Reference should already be right.
    await expect(page.getByText(/\d+ rows? ready to import/)).toBeVisible();

    await page.getByRole("button", { name: /Import \d+ Row/ }).click();
    await expect(page.getByText("Import complete", { exact: true })).toBeVisible();
    await expect(page.getByText("1 new transaction")).toBeVisible();
  });

  // The list defaults to filtering status=unmatched, so once this
  // transaction is ignored it would otherwise vanish from the very page
  // we're asserting against. Stay on ?status=all for the rest of the
  // test so the row remains visible across every status transition.
  await test.step("the transaction appears as unmatched", async () => {
    await page.getByRole("button", { name: "Go to Reconciliation" }).click();
    await expect(page).toHaveURL(/\/bank-reconciliation$/);
    await page.goto("/bank-reconciliation?status=all");
    await expect(page.getByRole("cell", { name: reference })).toBeVisible();
  });

  const row = page.locator("tr", { has: page.getByRole("cell", { name: reference }) });

  await test.step("ignore it", async () => {
    await row.getByRole("button", { name: "Ignore" }).click();
    await expect(row.getByText("Ignored", { exact: true })).toBeVisible();
  });

  await test.step("restore it back to unmatched", async () => {
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(row.getByText("Unmatched", { exact: true })).toBeVisible();
  });

  await test.step("re-importing the same file reports it as a duplicate", async () => {
    await page.goto("/bank-reconciliation/import");
    const csv = `Date,Description,Amount,Reference\n${today},E2E test deposit,321.55,${reference}\n`;
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e-statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
    await page.getByRole("button", { name: /Import \d+ Row/ }).click();
    await expect(page.getByText("0 new transactions imported, 1 already-imported row skipped.")).toBeVisible();
  });
});
