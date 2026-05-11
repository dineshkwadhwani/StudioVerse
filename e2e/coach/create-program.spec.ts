/**
 * P-PRG-001 — Coach (Shilpa) creates a Program.
 *
 * Same flow as the Company create-program test, but signed in as Shilpa
 * (company-associated coach). The Cloud Function role gate accepts
 * `professional`, so the save should succeed.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "Coach E2E Test Program";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("Coach · Manage Programs · Create Program", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", TEST_NAME);
  });

  test("Coach creates a draft Program (coin.png thumbnail)", async ({ page }) => {
    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/manage-programs", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Add Program$/ }).click();
    await page.waitForURL(/\/coaching-studio\/create-program/, { timeout: 15_000 });
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    await page
      .locator("#program-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();
    await page.fill("#program-name", TEST_NAME);
    await page.fill("#program-short-description", "Short description for Coach e2e test program.");
    await page.fill("#program-long-description", "Long description for the Coach e2e test program.");
    await page.fill("#program-details", "Detailed itinerary placeholder for the test program.");
    await page.fill("#program-credits-required", "50");
    await page.fill("#program-duration-value", "4");
    await page.selectOption("#program-duration-unit", "weeks");
    await page.fill("#program-facilitator-name", "Coach E2E Facilitator");
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    await page.getByRole("button", { name: /^Create$/ }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/create-program"), {
      timeout: 60_000,
    });

    const snap = await getAdminDb()
      .collection("programs")
      .where("name", "==", TEST_NAME)
      .get();
    expect(snap.docs).toHaveLength(1);
    const program = snap.docs[0]!.data();
    expect(program.tenantId).toBe(TENANT_ID);
    expect(Number(program.creditsRequired ?? 0)).toBe(50);
    expect(String(program.thumbnailUrl ?? "")).toMatch(/^https?:\/\/.+/);

    await page.goto("/coaching-studio/manage-programs", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(TEST_NAME, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
