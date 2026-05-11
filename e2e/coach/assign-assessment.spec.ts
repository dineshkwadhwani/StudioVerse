/**
 * P-ASGN-ASMT-001 — Coach (Shilpa) assigns an Assessment to coachee (Kiran).
 *
 * The test borrows an existing published assessment in `coaching-studio`
 * rather than fabricating a question-set fixture. PIEI ("Problem
 * Identification Effectiveness Index") is used because we've verified it
 * exists and is published.
 *
 * Idempotency: beforeEach deletes any prior assignment for this
 * (assessment × coachee) pair.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const ASSESSMENT_NAME = "Problem Identification Effectiveness Index (PIEI)";

let coachUserId = "";
let coacheeUserId = "";
let assessmentId = "";

test.describe("Coach · Assign Activity · Assign Assessment to coachee", () => {
  test.beforeAll(async () => {
    const [coach, coachee] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE.number),
    ]);
    if (!coach || !coachee) throw new Error("Required fixture users missing.");
    coachUserId = coach.id;
    coacheeUserId = coachee.id;

    const db = getAdminDb();
    const aSnap = await db
      .collection("assessments")
      .where("tenantId", "==", TENANT_ID)
      .where("name", "==", ASSESSMENT_NAME)
      .limit(1)
      .get();
    if (aSnap.empty) {
      throw new Error(
        `Fixture assessment "${ASSESSMENT_NAME}" missing in ${TENANT_ID}; update ASSESSMENT_NAME.`
      );
    }
    assessmentId = aSnap.docs[0]!.id;

    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: 200,
    });
  });

  test.beforeEach(async () => {
    if (assessmentId && coacheeUserId) {
      const db = getAdminDb();
      const snap = await db
        .collection("assignments")
        .where("activityId", "==", assessmentId)
        .where("assigneeId", "==", coacheeUserId)
        .get();
      for (const d of snap.docs) await d.ref.delete();
    }
  });

  test("Coach assigns the assessment to Kiran via AssignmentModal", async ({ page }) => {
    let assignedAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/has been assigned/i.test(dialog.message())) {
        assignedAlertSeen = true;
      }
      await dialog.dismiss();
    });

    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/assign-activity", { waitUntil: "domcontentloaded" });

    // Switch to Assessments tab.
    await page.getByRole("button", { name: /^Assessments$/ }).click();

    const card = page.locator("article", { hasText: ASSESSMENT_NAME }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole("button", { name: /^Find Out More$/ }).click();

    // Detail modal → Assign.
    await page.getByRole("button", { name: /^Assign$/ }).click();

    // Both DetailModal and AssignmentModal use class*="backdrop"; the
    // AssignmentModal opens on top so take the last one.
    const modal = page.locator('[class*="backdrop"]').last();
    await expect(modal.locator("#phoneOrEmail")).toBeVisible({ timeout: 15_000 });
    await modal.locator("#phoneOrEmail").fill(`+91${COACHEE.number}`);
    await modal.getByRole("button", { name: /^Search$/ }).click();

    await expect(modal.getByRole("button", { name: /^Continue$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Continue$/ }).click();

    await modal.getByRole("button", { name: /^Assign$/ }).click();
    await expect.poll(() => assignedAlertSeen, { timeout: 30_000 }).toBe(true);

    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", assessmentId)
      .where("assigneeId", "==", coacheeUserId)
      .get();
    expect(snap.docs).toHaveLength(1);
    const data = snap.docs[0]!.data();
    expect(String(data.activityType ?? "")).toBe("assessment");
    expect(String(data.assignerId ?? "")).toBe(coachUserId);
  });
});
