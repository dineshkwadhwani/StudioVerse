/**
 * C-COH-001 — Company creates a Cohort with a Coach + two Coachees.
 *
 * Coach:    8623972504 (Shilpa Shegaonkar — already associated to Narendra)
 * Coachee:  9167676738 (Kiran Wadhwani   — already associated)
 * Coachee:  9604188726 (Kartik Wagdeo    — independent in fixture)
 *
 * The cohort search filters individuals by `associatedCompanyId === companyId`
 * (src/services/cohorts.service.ts:318), so Kartik would not be findable
 * unless he's first associated. The test bootstraps that association in
 * `beforeAll` and reverts in `afterAll`, keeping the canonical fixture intact.
 *
 * Verifies:
 *   • Firestore — cohort doc exists with our name, tenant, professionalId set
 *     to Shilpa, and exactly two cohortMembers (Kiran + Kartik).
 *   • Cohort status is "active" (memberCount >= 2 AND professionalId set).
 *   • Cohorts In Scope list on the page shows the new cohort.
 *
 * Idempotency: beforeEach + afterEach delete any cohort with the test name
 * plus its cohortMembers; afterAll reverts Kartik's association.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { fieldByLabel } from "../../tests/helpers/playwright-forms";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  deleteDocsWhere,
  getAdminDb,
  getUserByPhone,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";

void deleteDocsWhere; // imported for completeness; deletion below is inlined.

const COMPANY = TEST_PHONES.company; // Narendra (9168676738)
const COACH = TEST_PHONES.coachAssociated; // Shilpa (8623972504)
const COACHEE_ASSOC = TEST_PHONES.individualAssociated; // Kiran (9167676738)
const COACHEE_IND = TEST_PHONES.individualIndependent; // Kartik (9604188726)

const COHORT_NAME = "E2E Test Cohort";
const TENANT_ID = "coaching-studio";

let companyUserId = "";
let coachUserId = "";
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

test.describe("Company · Manage Cohorts · Create Cohort", () => {
  test.beforeAll(async () => {
    const [company, coach, coacheeA, coacheeI] = await Promise.all([
      getUserByPhone(COMPANY.number),
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE_ASSOC.number),
      getUserByPhone(COACHEE_IND.number),
    ]);
    if (!company || !coach || !coacheeA || !coacheeI) {
      throw new Error("One or more required fixture users missing from studioverse-test.");
    }
    companyUserId = company.id;
    coachUserId = coach.id;
    coacheeAssocUserId = coacheeA.id;
    coacheeIndUserId = coacheeI.id;

    // Ensure Kartik (independent in fixture) is temporarily associated to
    // Narendra so the cohort search can find him.
    await setUserAssociatedCompany({
      userId: coacheeIndUserId,
      associatedCompanyId: companyUserId,
    });
  });

  test.afterAll(async () => {
    if (coacheeIndUserId) {
      await setUserAssociatedCompany({
        userId: coacheeIndUserId,
        associatedCompanyId: null,
      });
    }
  });

  test.beforeEach(async () => {
    await deleteCohortAndMembersByName(COHORT_NAME);
  });

  test.afterEach(async () => {
    await deleteCohortAndMembersByName(COHORT_NAME);
  });

  test("Company creates a Cohort with Coach Shilpa + 2 coachees (Kartik & Kiran)", async ({
    page,
  }) => {
    await signInAs(page, "company");

    await page.goto("/coaching-studio/manage-cohorts", { waitUntil: "domcontentloaded" });

    await expect(fieldByLabel(page, "Cohort Name")).toBeVisible({ timeout: 30_000 });

    // Cohort name + coach.
    await fieldByLabel(page, "Cohort Name").fill(COHORT_NAME);

    // The Coach select is the only <select> whose options include Shilpa.
    const coachSelect = page
      .locator("select")
      .filter({ has: page.locator(`option:has-text("${COACH.fullName}")`) })
      .first();
    await coachSelect.selectOption({ label: COACH.fullName });

    // Search + add Kiran (already associated coachee).
    const searchInput = page.locator('input[placeholder="Enter phone or email"]');
    await searchInput.fill(`+91${COACHEE_ASSOC.number}`);
    await page.getByRole("button", { name: /^Search$/ }).click();
    const kiranRow = page.getByText(COACHEE_ASSOC.fullName, { exact: true });
    await expect(kiranRow).toBeVisible({ timeout: 15_000 });
    await kiranRow
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: /^Add$/ })
      .click();

    // Search + add Kartik (temporarily associated by beforeAll).
    await searchInput.fill(`+91${COACHEE_IND.number}`);
    await page.getByRole("button", { name: /^Search$/ }).click();
    const kartikRow = page.getByText(COACHEE_IND.fullName, { exact: true });
    await expect(kartikRow).toBeVisible({ timeout: 15_000 });
    await kartikRow
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: /^Add$/ })
      .click();

    // Both coachees should be in the selected chips.
    await expect(page.getByText(/^Selected Existing Coachees \(2\)$/)).toBeVisible({
      timeout: 10_000,
    });

    // Save.
    await page.getByRole("button", { name: /^Create Cohort$/ }).click();

    // resetForm() clears the Cohort Name input on save success.
    await expect(fieldByLabel(page, "Cohort Name")).toHaveValue("", { timeout: 30_000 });

    // Verify cohort doc.
    const db = getAdminDb();
    const cohortSnap = await db.collection("cohorts").where("name", "==", COHORT_NAME).get();
    expect(cohortSnap.docs, "expected one cohort doc with the test name").toHaveLength(1);

    const cohort = cohortSnap.docs[0]!;
    const cohortData = cohort.data();
    expect(String(cohortData.tenantId ?? "")).toBe(TENANT_ID);
    expect(String(cohortData.companyId ?? "")).toBe(companyUserId);
    expect(String(cohortData.professionalId ?? "")).toBe(coachUserId);
    // Active = professional set AND memberCount ≥ 2.
    expect(String(cohortData.status ?? "")).toBe("active");

    // Verify cohort members.
    const memberSnap = await db
      .collection("cohortMembers")
      .where("cohortId", "==", cohort.id)
      .get();
    expect(memberSnap.docs).toHaveLength(2);
    const memberIds = memberSnap.docs.map((d) => d.data().individualUserId).sort();
    expect(memberIds).toEqual([coacheeAssocUserId, coacheeIndUserId].sort());

    // Cohorts In Scope list should show the new cohort.
    await expect(page.getByText(COHORT_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
