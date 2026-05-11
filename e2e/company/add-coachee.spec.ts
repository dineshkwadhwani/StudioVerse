/**
 * C-USR-002 — Company adds (associates) an existing Coachee via Manage Users.
 *
 * Same shape as `add-coach.spec.ts`, but Create User Type = Individual.
 *
 * Target phone: 9604188726 (Kartik Wagdeo, independent individual in fixture).
 *
 * Expected post-state:
 *   • The coachee's `associatedCompanyId` matches Narendra's user-doc id.
 *   • The coachee appears in the Users In Scope list on the Manage Users page.
 *
 * Idempotency:
 *   • beforeEach/afterEach revoke any prior association on Kartik so the
 *     test starts and ends with him independent.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getUserByPhone,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";

const COMPANY = TEST_PHONES.company; // Narendra
const TARGET = TEST_PHONES.individualIndependent; // Kartik (9604188726)

let companyUserId = "";
let coacheeUserId = "";

test.describe("Company · Manage Users · Add Coachee (associate existing)", () => {
  test.beforeAll(async () => {
    const company = await getUserByPhone(COMPANY.number);
    const coachee = await getUserByPhone(TARGET.number);
    if (!company) throw new Error(`Company ${COMPANY.number} not found in DB.`);
    if (!coachee) throw new Error(`Coachee ${TARGET.number} not found in DB.`);
    companyUserId = company.id;
    coacheeUserId = coachee.id;
  });

  test.beforeEach(async () => {
    await setUserAssociatedCompany({ userId: coacheeUserId, associatedCompanyId: null });
  });

  test.afterEach(async () => {
    await setUserAssociatedCompany({ userId: coacheeUserId, associatedCompanyId: null });
  });

  test("Company associates the independent coachee via Search-by-Phone", async ({ page }) => {
    await signInAs(page, "company");

    await page.goto("/coaching-studio/manage-users", { waitUntil: "domcontentloaded" });

    await expect(fieldByLabel(page, "Create User Type")).toBeVisible({ timeout: 30_000 });
    await fieldByLabel(page, "Create User Type").selectOption("individual");

    await fieldByLabel(page, "Phone Number").fill(`+91${TARGET.number}`);
    await page.getByRole("button", { name: /^Search by Phone$/ }).click();

    await expect(page.getByRole("button", { name: /^Create Association$/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /^Create Association$/ }).click();

    await expect(page.getByText(/associated successfully/i).first()).toBeVisible({
      timeout: 20_000,
    });

    const after = await getUserByPhone(TARGET.number);
    expect(after).not.toBeNull();
    expect(String(after!.data.associatedCompanyId ?? "")).toBe(companyUserId);

    await expect(page.getByText(TARGET.fullName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
