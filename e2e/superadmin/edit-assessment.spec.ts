/**
 * SA-ASMT-001 — SuperAdmin edits an existing Assessment.
 *
 * Flow: SA → /admin → Resources → Assessments tab → click Edit on the chosen
 * assessment → change shortDescription to a marker → Save → verify the change
 * persisted in Firestore.
 *
 * The test borrows an existing assessment in `coaching-studio` (so we don't
 * need to fabricate the complex Assessment + question fixture). The original
 * shortDescription is captured in beforeAll and restored in afterAll, so the
 * test leaves no permanent change behind.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TARGET_ASSESSMENT_NAME = "Problem Identification Effectiveness Index (PIEI)";
const MARKER = `E2E EDIT MARKER ${Date.now()}`;

let assessmentId = "";
let originalShortDescription = "";

test.describe("SuperAdmin · Manage Resources · Edit Assessment", () => {
  test.beforeAll(async () => {
    const db = getAdminDb();
    const snap = await db
      .collection("assessments")
      .where("tenantId", "==", TENANT_ID)
      .where("name", "==", TARGET_ASSESSMENT_NAME)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new Error(
        `Required fixture assessment "${TARGET_ASSESSMENT_NAME}" not found in tenant "${TENANT_ID}". ` +
          `Either create it in the SA portal or update TARGET_ASSESSMENT_NAME in this spec.`
      );
    }

    assessmentId = snap.docs[0]!.id;
    originalShortDescription = String(snap.docs[0]!.data().shortDescription ?? "");
  });

  test.afterAll(async () => {
    if (!assessmentId) return;
    // Restore original shortDescription so the test leaves no trace.
    await getAdminDb().collection("assessments").doc(assessmentId).update({
      shortDescription: originalShortDescription,
    });
  });

  test("SA edits the shortDescription of an existing assessment", async ({ page }) => {
    await signInAs(page, "superAdmin");

    // Navigate to Resources → Assessments.
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Resources$/ }).first().click();
    await page.locator("#resources-tab-assessments").click();

    // Find the target row by locating its title text, then climbing to the
    // nearest <article> ancestor. This is more robust than `.filter()` when
    // multiple assessment tiles share words.
    const title = page.getByText(TARGET_ASSESSMENT_NAME, { exact: true });
    await expect(title).toBeVisible({ timeout: 30_000 });
    const row = title.locator("xpath=ancestor::article[1]");
    await row.getByRole("button", { name: /^Edit$/ }).click();

    // Edit form is a modal. Wait for the shortDescription input and the Save
    // button to enable (which happens after generatedQuestions load).
    await expect(page.locator("#a-short")).toBeVisible({ timeout: 15_000 });
    const saveButton = page.getByRole("button", { name: /^Save Assessment$/ });
    await expect(saveButton).toBeEnabled({ timeout: 30_000 });

    // Apply the marker as the new shortDescription.
    await page.fill("#a-short", MARKER);

    await saveButton.click();

    // Form should close on success.
    await expect(page.locator("#a-short")).toBeHidden({ timeout: 60_000 });

    // Verify the change persisted in Firestore.
    const after = await getAdminDb().collection("assessments").doc(assessmentId).get();
    expect(after.exists).toBe(true);
    expect(String(after.data()?.shortDescription ?? "")).toBe(MARKER);
  });
});
