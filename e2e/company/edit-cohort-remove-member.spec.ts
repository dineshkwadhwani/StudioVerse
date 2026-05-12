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
const COACHEE_KEEP_A = TEST_PHONES.individualAssociated; // Kiran (stays)
const COACHEE_KEEP_B = TEST_PHONES.individualIndependent; // Kartik (stays)
// Synthetic third individual — the cohort form rejects updates that would
// drop a cohort below 2 members, so we start with 3 and remove this one.
const SYNTHETIC_INDIVIDUAL_UID = "tier2-cb4-synthetic-individual";
const SYNTHETIC_INDIVIDUAL_NAME = "Tier2 CB4 Synthetic Individual";
const TENANT_ID = "coaching-studio";
const COHORT_NAME = "Tier2 Edit-Cohort Target";

let companyUserId = "";
let coachUserId = "";
let kiranUserId = "";
let kartikUserId = "";
let cohortId = "";

async function ensureSyntheticIndividual(companyId: string) {
  const db = getAdminDb();
  await db.collection("users").doc(SYNTHETIC_INDIVIDUAL_UID).set(
    {
      userId: SYNTHETIC_INDIVIDUAL_UID,
      uid: SYNTHETIC_INDIVIDUAL_UID,
      tenantId: TENANT_ID,
      userType: "individual",
      status: "active",
      fullName: SYNTHETIC_INDIVIDUAL_NAME,
      firstName: "Tier2",
      lastName: "Synthetic",
      email: "tier2-cb4-synthetic@example.com",
      phoneE164: "+910000000000",
      associatedCompanyId: companyId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function deleteSyntheticIndividual() {
  await getAdminDb()
    .collection("users")
    .doc(SYNTHETIC_INDIVIDUAL_UID)
    .delete()
    .catch(() => {});
}

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
    memberCount: 3,
    status: "active",
    createdByUserId: companyUserId,
    createdByRole: "company",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  for (const individualUserId of [
    kiranUserId,
    kartikUserId,
    SYNTHETIC_INDIVIDUAL_UID,
  ]) {
    await db.collection("cohortMembers").add({
      cohortId: ref.id,
      companyId: companyUserId,
      professionalId: coachUserId,
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
      getUserByPhone(COACHEE_KEEP_A.number),
      getUserByPhone(COACHEE_KEEP_B.number),
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

    // Synthetic 3rd individual so the cohort starts at 3 members; the
    // UI rejects updates that would drop a cohort below 2 members.
    await ensureSyntheticIndividual(companyUserId);
  });

  test.afterAll(async () => {
    await deleteCohortAndMembers();
    if (kartikUserId) {
      await setUserAssociatedCompany({ userId: kartikUserId, associatedCompanyId: null });
    }
    await deleteSyntheticIndividual();
  });

  test.beforeEach(async () => {
    await deleteCohortAndMembers();
    cohortId = await bootstrapCohort();
  });

  test("Company edits cohort and removes the synthetic member → 2 members remain (still active)", async ({
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

    // After loading: "Selected Existing Coachees (3)" should appear.
    await expect(page.getByText(/^Selected Existing Coachees \(3\)$/)).toBeVisible({
      timeout: 15_000,
    });

    // Find the synthetic-individual chip span and click its × button.
    // Chips use a CSS-module class containing "chip" (but not "chipRemove",
    // which is the inner button).
    const targetChip = page
      .locator('span[class*="chip"]:not([class*="chipRemove"])')
      .filter({ hasText: SYNTHETIC_INDIVIDUAL_NAME })
      .first();
    await expect(targetChip).toBeVisible({ timeout: 15_000 });
    await targetChip.locator('button[class*="chipRemove"]').click();

    // Should now show "Selected Existing Coachees (2)".
    await expect(page.getByText(/^Selected Existing Coachees \(2\)$/)).toBeVisible({
      timeout: 10_000,
    });

    // Save.
    await page.getByRole("button", { name: /^Update Cohort$/ }).click();

    // Surface UI errors after save attempt (helps when the save bails).
    await page.waitForTimeout(2_000);
    const errs = (await page.locator('[class*="error"]').allTextContents()).filter(Boolean);
    if (errs.length) console.log("[debug] surfaced errors after Update Cohort:", errs);

    // Poll DB until the cohort has exactly 2 members (synthetic gone).
    const db = getAdminDb();
    let memberIds: string[] = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const members = await db.collection("cohortMembers").where("cohortId", "==", cohortId).get();
      memberIds = members.docs.map((d) => String(d.data().individualUserId ?? ""));
      if (memberIds.length === 2 && !memberIds.includes(SYNTHETIC_INDIVIDUAL_UID)) break;
      await page.waitForTimeout(1_000);
    }
    expect(memberIds.sort(), "expected only Kiran + Kartik remaining").toEqual(
      [kiranUserId, kartikUserId].sort()
    );

    // Cohort stays "active" (memberCount >= 2 + professional set).
    const cohortSnap = await db.collection("cohorts").doc(cohortId).get();
    expect(String(cohortSnap.data()?.status ?? "")).toBe("active");
    expect(Number(cohortSnap.data()?.memberCount ?? 0)).toBe(2);
  });
});
