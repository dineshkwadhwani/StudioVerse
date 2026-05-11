/**
 * SA-PRG-001 — SuperAdmin creates a new Program.
 *
 * Flow under test:
 *   1. SA signs in.
 *   2. Navigate /admin → Resources → Programs tab → Add Program.
 *   3. Fill required fields: Coaching Studio tenant checkbox, name, short/long
 *      descriptions, details, credits, duration, facilitator. Upload coin.png
 *      as the thumbnail. Leave "Publish now" unchecked (draft create).
 *   4. Click Create.
 *
 * Expected post-state (Admin SDK):
 *   • A `programs` doc exists with `name = TEST_NAME` and tenantId / tenantIds
 *     containing `coaching-studio`.
 *
 * Idempotency: beforeEach deletes any programs with the test name.
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "E2E Test Program";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

async function openResourcesPrograms(page: Page): Promise<void> {
  await page.locator('button[class*="profileButton"]').first().click();
  await page.getByRole("button", { name: /^Resources$/ }).first().click();
  await page.locator("#resources-tab-programs").click();
  await expect(page.getByRole("button", { name: /^Add Program$/ })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("SuperAdmin · Manage Resources · Create Program", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", TEST_NAME);
  });

  test("SA creates a draft Program in Coaching Studio with coin.png thumbnail", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");

    await openResourcesPrograms(page);

    // Open the form.
    await page.getByRole("button", { name: /^Add Program$/ }).click();
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    // Tenant: the form uses a checkbox group inside #program-tenant. Tick the
    // Coaching Studio entry.
    await page
      .locator("#program-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();

    // Required fields for a useful draft (and prerequisites if we ever flip
    // "Publish now" later in the suite).
    await page.fill("#program-name", TEST_NAME);
    await page.fill("#program-short-description", "Short description for e2e test program.");
    await page.fill(
      "#program-long-description",
      "Long description for the e2e test program. Created by the automation suite."
    );
    await page.fill(
      "#program-details",
      "Detailed itinerary placeholder for the e2e test program."
    );
    await page.fill("#program-credits-required", "50");
    await page.fill("#program-duration-value", "4");
    await page.selectOption("#program-duration-unit", "weeks");
    await page.fill("#program-facilitator-name", "E2E Facilitator");

    // Thumbnail upload — coin.png from the repo.
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    // Submit (Create — publish toggle stays off).
    await page.getByRole("button", { name: /^Create$/ }).click();

    // Form closes on save success. Wait for the form's own elements to be
    // detached — Add Program is always in DOM, so we wait on #program-name.
    await expect(page.locator("#program-name")).toBeHidden({ timeout: 60_000 });

    // Assert via Admin SDK that a single program with our name now exists in
    // the coaching-studio tenant.
    const db = getAdminDb();
    const snap = await db.collection("programs").where("name", "==", TEST_NAME).get();
    expect(snap.docs, "expected exactly one program doc with the test name").toHaveLength(1);

    const program = snap.docs[0]!.data();
    expect(program.tenantId).toBe(TENANT_ID);
    const tenantIds: string[] = Array.isArray(program.tenantIds) ? program.tenantIds : [];
    expect(tenantIds).toContain(TENANT_ID);
    expect(String(program.shortDescription ?? "")).toContain("Short description");
    expect(Number(program.creditsRequired ?? 0)).toBe(50);
    expect(Number(program.durationValue ?? 0)).toBe(4);
    expect(String(program.durationUnit ?? "")).toBe("weeks");
    // Thumbnail uploaded → thumbnailUrl should be a Firebase Storage URL.
    expect(String(program.thumbnailUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
