/**
 * C-B3 — Coach (Shilpa) assigns a Program to her Cohort.
 *
 * Note: the original C-B3 target was Company. Per current source, only
 * Professionals can reach the Assign button in DetailModal (Company is
 * mapped to userType="learner" which only shows "Recommend"). The
 * AssignmentModal already supports both roles for cohort assignment, but
 * the UI surface today only wires it up for Professional. We exercise
 * the Coach path here to cover the Cohort-target assignment flow.
 *
 * Setup (beforeAll):
 *   • Bootstrap a published + listing-attached Program (so it shows on
 *     /assign-activity which filters to isPublishedPublic + listing).
 *   • Temporarily associate Kartik to Narendra so he can be a cohort member.
 *   • Bootstrap a cohort with companyId=Narendra, professionalId=Shilpa,
 *     memberCount=2, status="active". Members: Kiran + Kartik.
 *   • Top up Shilpa's wallet for 2 members × 50 cost + buffer.
 *
 * Flow:
 *   1. Shilpa signs in → /coaching-studio/assign-activity.
 *   2. Programs tab → click "Find Out More" on the target program.
 *   3. DetailModal "Assign" → opens AssignmentModal.
 *   4. AssignmentModal switch to "Cohort" tab → pick cohort → Continue.
 *   5. Confirm stage → Assign. Wait for the success alert.
 *
 * Verifies:
 *   • cohortAssignments doc with cohortId + activityId.
 *   • Two assignments docs (one per member) tagged with cohortAssignmentId.
 *   • Shilpa's wallet debited by perMemberCost × memberCount.
 *
 * Cleanup: revert Kartik association, delete cohort/members/program/listing
 * package and any cohortAssignments / assignments for this run.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapDraftProgram,
  bootstrapListingPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
  getWalletStateForUser,
  setUserAssociatedCompany,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COMPANY = TEST_PHONES.company; // Narendra
const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE_ASSOC = TEST_PHONES.individualAssociated; // Kiran
const COACHEE_IND = TEST_PHONES.individualIndependent; // Kartik

const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Coach Cohort Assign Target";
const LISTING_PACKAGE_NAME = "Coach Cohort Assign Listing";
const COHORT_NAME = "E2E Coach Cohort Assign";
const PER_MEMBER_COST = 50; // bootstrapDraftProgram default
const MEMBER_COUNT = 2;

let companyUserId = "";
let coachUserId = "";
let kiranUserId = "";
let kartikUserId = "";
let programId = "";
let listingPackageId = "";
let cohortId = "";

async function deleteCohortAndChildren() {
  const db = getAdminDb();
  const cohortSnap = await db.collection("cohorts").where("name", "==", COHORT_NAME).get();
  for (const cohort of cohortSnap.docs) {
    const members = await db
      .collection("cohortMembers")
      .where("cohortId", "==", cohort.id)
      .get();
    for (const m of members.docs) await m.ref.delete();
    const cohortAssigns = await db
      .collection("cohortAssignments")
      .where("cohortId", "==", cohort.id)
      .get();
    for (const ca of cohortAssigns.docs) await ca.ref.delete();
    const childAssigns = await db
      .collection("assignments")
      .where("cohortId", "==", cohort.id)
      .get();
    for (const a of childAssigns.docs) await a.ref.delete();
    await cohort.ref.delete();
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
    memberCount: MEMBER_COUNT,
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

test.describe("Coach · Assign Activity · Assign Program to Cohort", () => {
  test.beforeAll(async () => {
    const [company, coach, kiran, kartik] = await Promise.all([
      getUserByPhone(COMPANY.number),
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE_ASSOC.number),
      getUserByPhone(COACHEE_IND.number),
    ]);
    if (!company || !coach || !kiran || !kartik) {
      throw new Error("Required fixture users missing.");
    }
    companyUserId = company.id;
    coachUserId = coach.id;
    kiranUserId = kiran.id;
    kartikUserId = kartik.id;

    // Kartik (independent in fixture) needs a temporary association so the
    // cohort treats him as in-scope.
    await setUserAssociatedCompany({
      userId: kartikUserId,
      associatedCompanyId: companyUserId,
    });

    // Published + listing-attached program (Assign Activities filter).
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    programId = await bootstrapDraftProgram({
      name: PROGRAM_NAME,
      tenantId: TENANT_ID,
      publish: true,
      listingPackageId,
    });

    // Fund Shilpa: needs >= PER_MEMBER_COST × MEMBER_COUNT.
    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: PER_MEMBER_COST * MEMBER_COUNT + 200,
    });
  });

  test.afterAll(async () => {
    await deleteCohortAndChildren();
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    if (kartikUserId) {
      await setUserAssociatedCompany({
        userId: kartikUserId,
        associatedCompanyId: null,
      });
    }
  });

  test.beforeEach(async () => {
    await deleteCohortAndChildren();
    cohortId = await bootstrapCohort();
  });

  test("Coach assigns a Program to a Cohort via the Cohort tab", async ({ page }) => {
    // AssignmentModal fires window.alert("...assigned to the cohort.") on success.
    let cohortAssignedAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/cohort/i.test(dialog.message()) && /assigned/i.test(dialog.message())) {
        cohortAssignedAlertSeen = true;
      }
      await dialog.dismiss();
    });

    // Snapshot wallet before for delta assertion.
    const before = await getWalletStateForUser(coachUserId);
    const availBefore = Number(before.wallet?.availableCoins ?? 0);

    await signInAs(page, "coachAssociated");
    await page.goto("/coaching-studio/assign-activity", { waitUntil: "domcontentloaded" });

    // Programs tab is default. Find the program card → Find Out More.
    const programCard = page.locator("article", { hasText: PROGRAM_NAME }).first();
    await expect(programCard).toBeVisible({ timeout: 30_000 });
    await programCard.getByRole("button", { name: /^Find Out More$/ }).click();

    // DetailModal opens; click "Assign" → opens AssignmentModal on top.
    await page.getByRole("button", { name: /^Assign$/ }).click();

    // Scope to the top modal — AssignmentModal is the last backdrop.
    const modal = page.locator('[class*="backdrop"]').last();
    await expect(modal.getByRole("button", { name: /^Cohort$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Cohort$/ }).click();

    // Cohort dropdown should populate via listCohortsForScope.
    const cohortSelect = modal.locator("#cohortSelect");
    await expect(cohortSelect).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => cohortSelect.locator("option").count(), { timeout: 15_000 })
      .toBeGreaterThan(1);
    await cohortSelect.selectOption({ value: cohortId });

    // Continue → confirm stage.
    await modal.getByRole("button", { name: /^Continue$/ }).click();
    await expect(modal.getByRole("button", { name: /^Assign$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Assign$/ }).click();

    // Wait for the success alert to fire.
    await expect.poll(() => cohortAssignedAlertSeen, { timeout: 30_000 }).toBe(true);

    // Verify cohortAssignments doc.
    const db = getAdminDb();
    const caSnap = await db
      .collection("cohortAssignments")
      .where("cohortId", "==", cohortId)
      .where("activityId", "==", programId)
      .get();
    expect(caSnap.docs, "expected one cohortAssignments doc").toHaveLength(1);
    const ca = caSnap.docs[0]!.data();
    expect(Number(ca.memberCount ?? 0)).toBe(MEMBER_COUNT);
    expect(Number(ca.perMemberCredits ?? 0)).toBe(PER_MEMBER_COST);

    // Verify per-member assignment docs.
    const assignSnap = await db
      .collection("assignments")
      .where("cohortId", "==", cohortId)
      .where("activityId", "==", programId)
      .get();
    expect(assignSnap.docs, "expected one assignment per member").toHaveLength(MEMBER_COUNT);
    const assigneeIds = assignSnap.docs.map((d) => String(d.data().assigneeId ?? "")).sort();
    expect(assigneeIds).toEqual([kiranUserId, kartikUserId].sort());

    // Verify Shilpa's wallet debit.
    const after = await getWalletStateForUser(coachUserId);
    const availAfter = Number(after.wallet?.availableCoins ?? 0);
    expect(availAfter).toBe(availBefore - PER_MEMBER_COST * MEMBER_COUNT);
  });
});
