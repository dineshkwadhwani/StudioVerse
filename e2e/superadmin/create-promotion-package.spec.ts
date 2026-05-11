/**
 * SA-PKG-PROMO-001 — SuperAdmin creates a Promotion Package for an Event.
 *
 * Idempotency: beforeEach deletes any promotionPackages doc with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "E2E Test Promotion Package (Event)";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Earning Packages · Create Promotion Package (Event)", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("promotionPackages", "name", TEST_NAME);
  });

  test("SA creates a Promotion Package for Events", async ({ page }) => {
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Earning Packages$/ }).first().click();
    await page.getByRole("button", { name: /^Promotion Packages$/ }).click();

    await page.getByRole("button", { name: /^Add Promotion Package$/ }).click();
    await expect(fieldByLabel(page, "Package Name")).toBeVisible({ timeout: 15_000 });

    await fieldByLabel(page, "Tenant").selectOption(TENANT_ID);
    await fieldByLabel(page, "Package Name").fill(TEST_NAME);
    await fieldByLabel(page, "Description").fill("E2E test promotion package for events.");
    await page.locator('input[type="file"]').setInputFiles(COIN_IMAGE);
    await fieldByLabel(page, "Promotion Resource").selectOption("event");
    await fieldByLabel(page, "Duration Value").fill("14");
    await fieldByLabel(page, "Duration Unit").selectOption("days");
    await fieldByLabel(page, "Promotion Cost (Credits)").fill("75");
    await fieldByLabel(page, "Status").selectOption("active");

    await page.getByRole("button", { name: /^Create Promotion Package$/ }).click();

    await expect(fieldByLabel(page, "Package Name")).toBeHidden({ timeout: 60_000 });

    const db = getAdminDb();
    const snap = await db.collection("promotionPackages").where("name", "==", TEST_NAME).get();
    expect(snap.docs).toHaveLength(1);

    const pkg = snap.docs[0]!.data();
    expect(String(pkg.tenantId ?? "")).toBe(TENANT_ID);
    expect(String(pkg.resourceType ?? "")).toBe("event");
    expect(Number(pkg.durationValue ?? 0)).toBe(14);
    expect(String(pkg.durationUnit ?? "")).toBe("days");
    expect(Number(pkg.costCredits ?? 0)).toBe(75);
    expect(String(pkg.status ?? "")).toBe("active");
    expect(String(pkg.imageUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
