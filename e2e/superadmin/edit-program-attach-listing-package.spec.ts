/**
 * SA-PRG-EDIT-001 — SuperAdmin edits an existing Program (draft mode).
 *
 * Scope note: scaled back from "attach a Listing Package" per user direction
 * 2026-05-11. The Listing Package selector only renders when "Publish now"
 * is ticked, which we're keeping unchecked. This test exercises the
 * edit-and-save path against an existing Program.
 *
 * The Program is created in-test via the same UI flow as create-program.spec
 * (rather than bootstrapped via Admin SDK) so it goes through the production
 * normalisation pipeline and passes the Cloud Function's schema validation
 * on the subsequent edit.
 *
 * Verifies both:
 *   • Firestore — `shortDescription` is the marker value.
 *   • Manage Programs page — the program is listed and the new shortDescription
 *     is visible on its tile.
 *
 * Idempotency: beforeEach deletes any programs with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "E2E Edit Program (draft)";
const MARKER = `E2E EDIT MARKER ${Date.now()}`;
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Resources · Edit Program (draft)", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
  });

  test("SA creates a Program via UI, then edits shortDescription and saves as draft", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Resources$/ }).first().click();
    await page.locator("#resources-tab-programs").click();
    await expect(page.getByRole("button", { name: /^Add Program$/ })).toBeVisible({
      timeout: 15_000,
    });

    // ── 1. Create the Program via the UI (no publish). ─────────────────────
    await page.getByRole("button", { name: /^Add Program$/ }).click();
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    await page
      .locator("#program-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();
    await page.fill("#program-name", PROGRAM_NAME);
    await page.fill("#program-short-description", "Initial short description.");
    await page.fill("#program-long-description", "Initial long description.");
    await page.fill("#program-details", "Initial details.");
    await page.fill("#program-credits-required", "50");
    await page.fill("#program-duration-value", "4");
    await page.selectOption("#program-duration-unit", "weeks");
    await page.fill("#program-facilitator-name", "E2E Facilitator");
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(page.locator("#program-name")).toBeHidden({ timeout: 60_000 });

    // Verify the new program is visible on the Manage Programs page list.
    await expect(page.getByText(PROGRAM_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // ── 2. Open it in Edit and change shortDescription. ────────────────────
    const title = page.getByText(PROGRAM_NAME, { exact: true });
    const row = title.locator("xpath=ancestor::article[1]");
    await row.getByRole("button", { name: /^Edit$/ }).click();

    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });
    await page.fill("#program-short-description", MARKER);

    // Save in draft mode (leave Publish unchecked).
    await page.getByRole("button", { name: /^Update$/ }).click();
    await expect(page.locator("#program-name")).toBeHidden({ timeout: 60_000 });

    // ── 3. Verify both UI and Firestore reflect the change. ────────────────
    // UI: the new shortDescription should appear on the program tile.
    await expect(page.getByText(MARKER)).toBeVisible({ timeout: 15_000 });

    // Firestore.
    const snap = await getAdminDb()
      .collection("programs")
      .where("name", "==", PROGRAM_NAME)
      .get();
    expect(snap.docs).toHaveLength(1);
    expect(String(snap.docs[0]!.data().shortDescription ?? "")).toBe(MARKER);
    expect(snap.docs[0]!.data().tenantId).toBe(TENANT_ID);
  });
});
