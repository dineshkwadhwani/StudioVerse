/**
 * P-COH-001 — Coach (Shilpa) creates a Cohort with Kartik + Kiran.
 *
 * As a Professional, the cohort creator is automatically the coach — there's
 * no "Choose Coach" select on the form (the page shows "As a Coach, you are
 * automatically assigned to the Cohort.").
 *
 * Coachees:
 *   • Kiran (9167676738) — company-associated to Narendra (Shilpa's company).
 *     Visible via the fallback search.
 *   • Kartik (9604188726) — independent in fixture. Temporarily associated
 *     to Narendra in beforeAll so the cohort search finds him.
 *
 * NOTE: saveCohort updates each member's user doc with associatedCompanyId
 * and associatedProfessionalId. This may hit the same Professional-initial-
 * association rule gap as P-3 (add-coachee). If so, the save fails with
 * "Missing or insufficient permissions."
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getAdminDb,
  getUserByPhone,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE_ASSOC = TEST_PHONES.individualAssociated; // Kiran
const COACHEE_IND = TEST_PHONES.individualIndependent; // Kartik
const COMPANY = TEST_PHONES.company; // Narendra (Shilpa's company)

const COHORT_NAME = "Coach E2E Test Cohort";
const TENANT_ID = "coaching-studio";

let coachUserId = "";
let companyUserId = "";
let coacheeAssocUserId = "";
let coacheeIndUserId = "";

async function deleteCohortAndMembersByName(name: string) {
  const db = getAdminDb();
  const cohortSnap = await db.collection("cohorts").where("name", "==", name).get();
  for (const cohort of cohortSnap.docs) {
    const members = await db
      .collection("cohortMembers")
      .where("cohortId", "==", cohort.id)
      .get();
    for (const m of members.docs) {
      await m.ref.delete();
    }
    await cohort.ref.delete();
  }
}

test.describe("Coach · Manage Cohorts · Create Cohort", () => {
  test.beforeAll(async () => {
    const [coach, company, coacheeA, coacheeI] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COMPANY.number),
      getUserByPhone(COACHEE_ASSOC.number),
      getUserByPhone(COACHEE_IND.number),
    ]);
    if (!coach || !company || !coacheeA || !coacheeI) {
      throw new Error("Required fixture users missing from studioverse-test.");
    }
    coachUserId = coach.id;
    companyUserId = company.id;
    coacheeAssocUserId = coacheeA.id;
    coacheeIndUserId = coacheeI.id;

    // Temporarily associate Kartik to Narendra so Shilpa's cohort search
    // returns him via the fallback (Professional-with-company scope).
    await setUserAssociatedCompany({
      userId: coacheeIndUserId,
      associatedCompanyId: companyUserId,
    });
  });

  test.afterAll(async () => {
    if (coacheeIndUserId) {
      await setUserAssociatedCompany({ userId: coacheeIndUserId, associatedCompanyId: null });
    }
  });

  test.beforeEach(async () => {
    await deleteCohortAndMembersByName(COHORT_NAME);
  });

  test.afterEach(async () => {
    await deleteCohortAndMembersByName(COHORT_NAME);
  });

  test("Coach creates a Cohort with Kartik + Kiran (auto-coach = Shilpa, status active)", async ({
    page,
  }) => {
    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/manage-cohorts", { waitUntil: "domcontentloaded" });

    await expect(fieldByLabel(page, "Cohort Name")).toBeVisible({ timeout: 30_000 });
    await fieldByLabel(page, "Cohort Name").fill(COHORT_NAME);

    // Search + add Kiran.
    const searchInput = page.locator('input[placeholder="Enter phone or email"]');
    await searchInput.fill(`+91${COACHEE_ASSOC.number}`);
    await page.getByRole("button", { name: /^Search$/ }).click();
    const kiranRow = page.getByText(COACHEE_ASSOC.fullName, { exact: true });
    await expect(kiranRow).toBeVisible({ timeout: 15_000 });
    await kiranRow
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: /^Add$/ })
      .click();

    // Search + add Kartik.
    await searchInput.fill(`+91${COACHEE_IND.number}`);
    await page.getByRole("button", { name: /^Search$/ }).click();
    const kartikRow = page.getByText(COACHEE_IND.fullName, { exact: true });
    await expect(kartikRow).toBeVisible({ timeout: 15_000 });
    await kartikRow
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: /^Add$/ })
      .click();

    await expect(page.getByText(/^Selected Existing Coachees \(2\)$/)).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: /^Create Cohort$/ }).click();

    // Form clears on success.
    await expect(fieldByLabel(page, "Cohort Name")).toHaveValue("", { timeout: 30_000 });

    const db = getAdminDb();
    const cohortSnap = await db.collection("cohorts").where("name", "==", COHORT_NAME).get();
    expect(cohortSnap.docs).toHaveLength(1);
    const cohort = cohortSnap.docs[0]!;
    const cohortData = cohort.data();
    expect(String(cohortData.tenantId ?? "")).toBe(TENANT_ID);
    expect(String(cohortData.professionalId ?? "")).toBe(coachUserId);
    expect(String(cohortData.status ?? "")).toBe("active");

    const memberSnap = await db
      .collection("cohortMembers")
      .where("cohortId", "==", cohort.id)
      .get();
    expect(memberSnap.docs).toHaveLength(2);
    const memberIds = memberSnap.docs.map((d) => d.data().individualUserId).sort();
    expect(memberIds).toEqual([coacheeAssocUserId, coacheeIndUserId].sort());

    await expect(page.getByText(COHORT_NAME, { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
