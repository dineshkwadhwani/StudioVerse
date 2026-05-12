/**
 * C-B4 — Company removes a Coachee from an existing Cohort.
 *
 * Bootstrap a cohort with Shilpa (Professional) + Kiran + Kartik (members).
 * Company opens Manage Cohorts → Edit Cohort → click × on Kartik's chip →
 * Update Cohort. Verify only Kiran remains and the cohort flips to
 * "inactive" because memberCount drops below 2.
 *
 * Cleanup: delete cohort + cohortMembers; revert Kartik association.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getAdminDb,
  getUserByPhone,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COMPANY = TEST_PHONES.company; // Narendra
const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE_KEEP = TEST_PHONES.individualAssociated; // Kiran (stays)
const COACHEE_REMOVE = TEST_PHONES.individualIndependent; // Kartik (removed)
const TENANT_ID = "coaching-studio";
const COHORT_NAME = "Tier2 Edit-Cohort Target";

let companyUserId = "";
let coachUserId = "";
let kiranUserId = "";
let kartikUserId = "";
let cohortId = "";

async function deleteCohortAndMembers() {
  const db = getAdminDb();
  const snap = await db.collection("cohorts").where("name", "==", COHORT_NAME).get();
  for (const c of snap.docs) {
    const members = await db.collection("cohortMembers").where("cohortId", "==", c.id).get();
    for (const m of members.docs) await m.ref.delete();
    await c.ref.delete();
  }
}

async function bootstrapCohort(): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection("cohorts").doc();
  await ref.set({
    tenantId: TENANT_ID,
    companyId: companyUserId,
    professionalId: coachUserId,
    name: COHORT_NAME,
    memberCount: 2,
    status: "active",
    createdByUserId: companyUserId,
    createdByRole: "company",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  for (const individualUserId of [kiranUserId, kartikUserId]) {
    await db.collection("cohortMembers").add({
      cohortId: ref.id,
      individualUserId,
      addedByUserId: companyUserId,
      addedAt: FieldValue.serverTimestamp(),
    });
  }
  return ref.id;
}

test.describe("Company · Manage Cohorts · Remove Member from existing Cohort", () => {
  test.beforeAll(async () => {
    const [company, coach, kiran, kartik] = await Promise.all([
      getUserByPhone(COMPANY.number),
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE_KEEP.number),
      getUserByPhone(COACHEE_REMOVE.number),
    ]);
    if (!company || !coach || !kiran || !kartik) throw new Error("Fixture users missing.");
    companyUserId = company.id;
    coachUserId = coach.id;
    kiranUserId = kiran.id;
    kartikUserId = kartik.id;

    // Kartik (independent fixture) must be associated to Narendra so the
    // cohort detail loader maps him correctly.
    await setUserAssociatedCompany({
      userId: kartikUserId,
      associatedCompanyId: companyUserId,
    });
  });

  test.afterAll(async () => {
    await deleteCohortAndMembers();
    if (kartikUserId) {
      await setUserAssociatedCompany({ userId: kartikUserId, associatedCompanyId: null });
    }
  });

  test.beforeEach(async () => {
    await deleteCohortAndMembers();
    cohortId = await bootstrapCohort();
  });

  test("Company edits cohort and removes Kartik → 1 member remains, status=inactive", async ({
    page,
  }) => {
    await signInAs(page, "company");
    await page.goto("/coaching-studio/manage-cohorts", { waitUntil: "domcontentloaded" });

    // Locate our cohort row in "Cohorts In Scope" and click Edit Cohort.
    const ourRow = page
      .getByText(COHORT_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourRow).toBeVisible({ timeout: 30_000 });
    await ourRow.getByRole("button", { name: /^Edit Cohort$/ }).click();

    // After loading the cohort into the form, the "Selected Existing
    // Coachees (2)" section should show both names. Wait for the section.
    await expect(page.getByText(/^Selected Existing Coachees \(2\)$/)).toBeVisible({
      timeout: 15_000,
    });

    // Each chip is a span containing the member name as text + an × button.
    // Filter chips by Kartik's name (or any unique substring) then click ×.
    const kartikChip = page
      .locator("span")
      .filter({ hasText: COACHEE_REMOVE.fullName })
      .filter({ has: page.getByRole("button", { name: "x" }) })
      .first();
    await expect(kartikChip).toBeVisible({ timeout: 15_000 });
    await kartikChip.getByRole("button", { name: "x" }).click();

    // Now should show "Selected Existing Coachees (1)".
    await expect(page.getByText(/^Selected Existing Coachees \(1\)$/)).toBeVisible({
      timeout: 10_000,
    });

    // Save.
    await page.getByRole("button", { name: /^Update Cohort$/ }).click();

    // Poll DB until the cohort has exactly 1 member.
    const db = getAdminDb();
    let memberIds: string[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const members = await db.collection("cohortMembers").where("cohortId", "==", cohortId).get();
      memberIds = members.docs.map((d) => String(d.data().individualUserId ?? ""));
      if (memberIds.length === 1) break;
      await page.waitForTimeout(1_000);
    }
    expect(memberIds, "expected exactly one member remaining").toHaveLength(1);
    expect(memberIds[0]).toBe(kiranUserId);

    // Cohort status should be "inactive" (memberCount < 2).
    const cohortSnap = await db.collection("cohorts").doc(cohortId).get();
    expect(String(cohortSnap.data()?.status ?? "")).toBe("inactive");
    expect(Number(cohortSnap.data()?.memberCount ?? 0)).toBe(1);
  });
});
