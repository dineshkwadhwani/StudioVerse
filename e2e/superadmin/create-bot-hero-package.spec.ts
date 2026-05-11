/**
 * SA-PKG-BOT-001 — SuperAdmin creates a Bot Hero Package for "1 month".
 *
 * Note: the Bot Hero schema only supports `days` or `weeks` units, so "1
 * month" is encoded as 4 weeks.
 *
 * Idempotency: beforeEach deletes any botHeroPackages doc with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TEST_NAME = "E2E Test Bot Hero Package (1 month)";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Earning Packages · Create Bot Hero Package", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("botHeroPackages", "name", TEST_NAME);
  });

  test("SA creates a Bot Hero Package for 4 weeks (= 1 month)", async ({ page }) => {
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Earning Packages$/ }).first().click();
    await page.getByRole("button", { name: /^Bot Hero$/ }).click();

    await page.getByRole("button", { name: /^Add Bot Hero Package$/ }).click();
    await expect(fieldByLabel(page, "Package Name")).toBeVisible({ timeout: 15_000 });

    await fieldByLabel(page, "Package Name").fill(TEST_NAME);
    await fieldByLabel(page, "Description").fill("E2E test bot hero package (1 month / 4 weeks).");
    await page.locator('input[type="file"]').setInputFiles(COIN_IMAGE);
    await fieldByLabel(page, "Duration Value").fill("4");
    await fieldByLabel(page, "Duration Unit").selectOption("weeks");
    await fieldByLabel(page, "Credits (cost)").fill("1000");
    await fieldByLabel(page, "Sort Order").fill("99");
    await fieldByLabel(page, "Status").selectOption("active");

    await page.getByRole("button", { name: /^Create Bot Hero Package$/ }).click();

    await expect(fieldByLabel(page, "Package Name")).toBeHidden({ timeout: 60_000 });

    const db = getAdminDb();
    const snap = await db.collection("botHeroPackages").where("name", "==", TEST_NAME).get();
    expect(snap.docs).toHaveLength(1);

    const pkg = snap.docs[0]!.data();
    expect(Number(pkg.durationValue ?? 0)).toBe(4);
    expect(String(pkg.durationUnit ?? "")).toBe("weeks");
    // The cost field may be named `credits` or `costCredits` depending on the
    // schema — assert via whichever is present.
    const cost = Number(pkg.costCredits ?? pkg.credits ?? 0);
    expect(cost).toBe(1000);
    // Bot Hero schema stores `active: boolean`, not a `status` string. The
    // Status select label maps to that boolean.
    expect(pkg.active).toBe(true);
    expect(String(pkg.imageUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
