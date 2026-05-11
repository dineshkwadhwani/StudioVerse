/**
 * SA-PKG-CRED-001 — SuperAdmin creates a Credit Package.
 *
 * Flow: SA → /admin → Earning Packages → Credit Packages tab → Add Credit
 * Package → fill name, description, credits, price, sort order, upload
 * coin.png → Create Credit Package.
 *
 * Idempotency: beforeEach deletes any coinPackages doc with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TEST_NAME = "E2E Test Credit Package";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Earning Packages · Create Credit Package", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("coinPackages", "name", TEST_NAME);
  });

  test("SA creates a Credit Package with coin.png", async ({ page }) => {
    await signInAs(page, "superAdmin");

    // Navigate to Earning Packages.
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Earning Packages$/ }).first().click();

    // Credit Packages tab is selected by default; click anyway for stability.
    await page.getByRole("button", { name: /^Credit Packages$/ }).click();

    // Open the create form.
    await page.getByRole("button", { name: /^Add Credit Package$/ }).click();
    await expect(fieldByLabel(page, "Credit Package Name")).toBeVisible({
      timeout: 15_000,
    });

    // Fill the form via label-based lookups (no IDs on these inputs).
    await fieldByLabel(page, "Credit Package Name").fill(TEST_NAME);
    await fieldByLabel(page, "Description").fill("E2E test credit package description.");
    // Upload coin.png — only file input in this dialog.
    await page.locator('input[type="file"]').setInputFiles(COIN_IMAGE);
    await fieldByLabel(page, "Credits").fill("100");
    await fieldByLabel(page, "Price (₹)").fill("250");
    await fieldByLabel(page, "Sort Order").fill("99");
    await fieldByLabel(page, "Status").selectOption("active");

    await page.getByRole("button", { name: /^Create Credit Package$/ }).click();

    // Form closes on success.
    await expect(fieldByLabel(page, "Credit Package Name")).toBeHidden({
      timeout: 60_000,
    });

    // Verify in Firestore.
    const db = getAdminDb();
    const snap = await db.collection("coinPackages").where("name", "==", TEST_NAME).get();
    expect(snap.docs).toHaveLength(1);

    const pkg = snap.docs[0]!.data();
    expect(Number(pkg.credits ?? 0)).toBe(100);
    expect(Number(pkg.priceInr ?? 0)).toBe(250);
    expect(Number(pkg.sortOrder ?? 0)).toBe(99);
    expect(String(pkg.status ?? "")).toBe("active");
    expect(String(pkg.imageUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
