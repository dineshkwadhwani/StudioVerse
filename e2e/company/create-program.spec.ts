/**
 * C-PRG-001 — Company creates a Program.
 *
 * Flow under test (since the user wired the dedicated create page):
 *   1. Company signs in.
 *   2. Navigate `/coaching-studio/manage-programs`.
 *   3. Click "Add Program" → routes to `/coaching-studio/create-program`.
 *   4. Fill the program form (no publish), upload coin.png thumbnail.
 *   5. Click Create. The page sets a success message and auto-redirects to
 *      `/coaching-studio/manage-resources` after ~1.5 s.
 *
 * Expected post-state:
 *   • A `programs/` doc with the test name in tenant `coaching-studio`.
 *   • Once back on Manage Programs, the new program is in the list.
 *
 * Idempotency: beforeEach deletes any programs with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "Company E2E Test Program";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("Company · Manage Programs · Create Program", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", TEST_NAME);
  });

  test("Company creates a draft Program (coin.png thumbnail)", async ({ page }) => {
    await signInAs(page, "company");

    // 1. Manage Programs → Add Program → routes to /create-program.
    await page.goto("/coaching-studio/manage-programs", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Add Program$/ }).click();
    await page.waitForURL(/\/coaching-studio\/create-program/, { timeout: 15_000 });
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    // 2. Fill the form (no publish).
    await page
      .locator("#program-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();

    await page.fill("#program-name", TEST_NAME);
    await page.fill("#program-short-description", "Short description for Company e2e test program.");
    await page.fill("#program-long-description", "Long description for the Company e2e test program.");
    await page.fill("#program-details", "Detailed itinerary placeholder for the test program.");
    await page.fill("#program-credits-required", "50");
    await page.fill("#program-duration-value", "4");
    await page.selectOption("#program-duration-unit", "weeks");
    await page.fill("#program-facilitator-name", "Company E2E Facilitator");
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    // 3. Save.
    await page.getByRole("button", { name: /^Create$/ }).click();

    // 4. The page auto-redirects away from /create-program on success.
    await page.waitForURL((url) => !url.pathname.endsWith("/create-program"), {
      timeout: 60_000,
    });

    // 5. Firestore — single program doc with our name in coaching-studio.
    const snap = await getAdminDb()
      .collection("programs")
      .where("name", "==", TEST_NAME)
      .get();
    expect(snap.docs, "expected exactly one program doc with the test name").toHaveLength(1);

    const program = snap.docs[0]!.data();
    expect(program.tenantId).toBe(TENANT_ID);
    expect(Number(program.creditsRequired ?? 0)).toBe(50);
    expect(Number(program.durationValue ?? 0)).toBe(4);
    expect(String(program.durationUnit ?? "")).toBe("weeks");
    expect(String(program.thumbnailUrl ?? "")).toMatch(/^https?:\/\/.+/);

    // 6. Navigate to Manage Programs and confirm the program is listed.
    await page.goto("/coaching-studio/manage-programs", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(TEST_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
