/**
 * P-USR-001 — Coach (Shilpa) associates a Coachee (Kartik) via Manage Users.
 *
 * NOTE: This test may fail with `Missing or insufficient permissions` if the
 * `/users` update rule does not yet have a Professional-initial-association
 * arm. The Company-initial-association arm was added at firestore.rules:65-68;
 * a Professional equivalent is required for this flow.
 *
 * Idempotency: beforeEach/afterEach revoke Kartik's association so the test
 * starts and ends with him independent.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getUserByPhone,
  setUserAssociatedCompany,
  getAdminDb,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa (8623972504)
const TARGET = TEST_PHONES.individualIndependent; // Kartik (9604188726)

let coachUserId = "";
let coacheeUserId = "";

async function resetCoachee(): Promise<void> {
  if (!coacheeUserId) return;
  await setUserAssociatedCompany({ userId: coacheeUserId, associatedCompanyId: null });
  await getAdminDb().collection("users").doc(coacheeUserId).update({
    associatedProfessionalId: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

test.describe("Coach · Manage Users · Add Coachee (associate existing)", () => {
  test.beforeAll(async () => {
    const [coach, coachee] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(TARGET.number),
    ]);
    if (!coach || !coachee) {
      throw new Error("Coach or coachee fixture missing in studioverse-test.");
    }
    coachUserId = coach.id;
    coacheeUserId = coachee.id;
  });

  test.beforeEach(resetCoachee);
  test.afterEach(resetCoachee);

  test("Coach associates the independent coachee via Search-by-Phone", async ({ page }) => {
    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/manage-users", { waitUntil: "domcontentloaded" });

    await expect(fieldByLabel(page, "Create User Type")).toBeVisible({ timeout: 30_000 });
    // Coach can only create Individuals; the select likely has just "Individual".
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

    // Verify in DB: associatedProfessionalId = Shilpa's uid.
    const after = await getUserByPhone(TARGET.number);
    expect(after).not.toBeNull();
    expect(String(after!.data.associatedProfessionalId ?? "")).toBe(coachUserId);

    // The coachee appears in the Coach's Users In Scope list.
    await expect(page.getByText(TARGET.fullName, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
