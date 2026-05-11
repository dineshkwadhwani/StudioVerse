/**
 * C-USR-001 — Company adds (associates) an existing Coach via Manage Users.
 *
 * Flow under test:
 *   1. Company (Narendra) signs in.
 *   2. Navigate /coaching-studio/manage-users.
 *   3. Select Create User Type = Professional.
 *   4. Enter the coach's phone, click Search by Phone — the page recognises
 *      the existing user and switches to association mode.
 *   5. Click "Create Association".
 *
 * Expected post-state:
 *   • In Firestore, the coach's `associatedCompanyId` matches Narendra's
 *     user-doc id.
 *   • The coach appears in the "Users In Scope" list on the page.
 *
 * Target phone: 9604188725 (Dinesh Wadhwani, independent coach in the fixture).
 *
 * Idempotency:
 *   • beforeEach revokes any prior association so the test always starts
 *     with Dinesh independent.
 *   • afterEach restores Dinesh to independent (revoke association) so the
 *     fixture stays as documented.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getUserByPhone,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";

const COMPANY = TEST_PHONES.company; // Narendra (9168676738)
const TARGET = TEST_PHONES.coachIndependent; // Dinesh (9604188725)

let companyUserId = "";
let coachUserId = "";

test.describe("Company · Manage Users · Add Coach (associate existing)", () => {
  test.beforeAll(async () => {
    const company = await getUserByPhone(COMPANY.number);
    const coach = await getUserByPhone(TARGET.number);
    if (!company) throw new Error(`Company ${COMPANY.number} not found in DB.`);
    if (!coach) throw new Error(`Coach ${TARGET.number} not found in DB.`);
    companyUserId = company.id;
    coachUserId = coach.id;
  });

  test.beforeEach(async () => {
    await setUserAssociatedCompany({ userId: coachUserId, associatedCompanyId: null });
  });

  test.afterEach(async () => {
    await setUserAssociatedCompany({ userId: coachUserId, associatedCompanyId: null });
  });

  test("Company associates the independent coach via Search-by-Phone", async ({ page }) => {
    await signInAs(page, "company");

    await page.goto("/coaching-studio/manage-users", { waitUntil: "domcontentloaded" });

    // Wait for the form to render.
    await expect(fieldByLabel(page, "Create User Type")).toBeVisible({ timeout: 30_000 });

    // Pick Professional as the target user type.
    await fieldByLabel(page, "Create User Type").selectOption("professional");

    // Enter phone + search.
    await fieldByLabel(page, "Phone Number").fill(`+91${TARGET.number}`);
    await page.getByRole("button", { name: /^Search by Phone$/ }).click();

    // The page should switch to association mode (button text changes).
    await expect(page.getByRole("button", { name: /^Create Association$/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /^Create Association$/ }).click();

    // Success info appears.
    await expect(page.getByText(/associated successfully/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // Verify in DB.
    const after = await getUserByPhone(TARGET.number);
    expect(after, "coach should still exist post-associate").not.toBeNull();
    expect(String(after!.data.associatedCompanyId ?? "")).toBe(companyUserId);

    // Verify the coach appears in the "Users In Scope" list on the page.
    await expect(page.getByText(TARGET.fullName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
