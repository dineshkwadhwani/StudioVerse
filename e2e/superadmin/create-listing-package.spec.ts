/**
 * SA-PKG-LIST-001 — SuperAdmin creates a Listing Package for a Program.
 *
 * Idempotency: beforeEach deletes any listingPackages doc with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "E2E Test Listing Package (Program)";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Earning Packages · Create Listing Package (Program)", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("listingPackages", "name", TEST_NAME);
  });

  test("SA creates a Listing Package for Programs", async ({ page }) => {
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Earning Packages$/ }).first().click();
    await page.getByRole("button", { name: /^Listing Packages$/ }).click();

    await page.getByRole("button", { name: /^Add Listing Package$/ }).click();
    await expect(fieldByLabel(page, "Package Name")).toBeVisible({ timeout: 15_000 });

    await fieldByLabel(page, "Tenant").selectOption(TENANT_ID);
    await fieldByLabel(page, "Package Name").fill(TEST_NAME);
    await fieldByLabel(page, "Description").fill("E2E test listing package for programs.");
    await page.locator('input[type="file"]').setInputFiles(COIN_IMAGE);
    await fieldByLabel(page, "Listing Resource").selectOption("program");
    await fieldByLabel(page, "Duration Value").fill("30");
    await fieldByLabel(page, "Duration Unit").selectOption("days");
    await fieldByLabel(page, "Status").selectOption("active");

    // Some forms call this "Credits" or "Cost (Credits)" — fill any visible
    // credits field.
    const creditsField = page.locator(
      'xpath=//label[contains(translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "credit")]/following-sibling::*[self::input][1]'
    );
    if (await creditsField.count()) {
      await creditsField.first().fill("50");
    }

    await page.getByRole("button", { name: /^Create Listing Package$/ }).click();

    await expect(fieldByLabel(page, "Package Name")).toBeHidden({ timeout: 60_000 });

    const db = getAdminDb();
    const snap = await db.collection("listingPackages").where("name", "==", TEST_NAME).get();
    expect(snap.docs).toHaveLength(1);

    const pkg = snap.docs[0]!.data();
    expect(String(pkg.tenantId ?? "")).toBe(TENANT_ID);
    expect(String(pkg.resourceType ?? "")).toBe("program");
    expect(Number(pkg.durationValue ?? 0)).toBe(30);
    expect(String(pkg.durationUnit ?? "")).toBe("days");
    expect(String(pkg.status ?? "")).toBe("active");
    expect(String(pkg.imageUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
