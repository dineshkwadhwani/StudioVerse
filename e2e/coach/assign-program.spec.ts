/**
 * P-ASGN-PRG-001 — Coach (Shilpa) assigns a Program to coachee (Kiran).
 *
 * Setup (beforeAll):
 *   • Ensure a test Program exists ("Coach Assign Program Target").
 *   • Top up Shilpa's wallet so she can afford the assignment cost.
 *   • Kiran is already associated to Narendra; she is in Shilpa's scope via
 *     the fallback search.
 *
 * Flow:
 *   1. Shilpa signs in → /coaching-studio/assign-activity.
 *   2. Programs tab → click "Find Out More" on the target program.
 *   3. In the detail modal click "Assign" → opens AssignmentModal.
 *   4. Enter Kiran's phone → Search → Continue → Assign.
 *
 * Verifies:
 *   • A new `assignments/` doc exists for assigneeId=Kiran, activityId=program.
 *
 * Idempotency: beforeEach deletes any prior assignments doc for this pair.
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
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Coach Assign Program Target";
const LISTING_PACKAGE_NAME = "Coach Assign Listing Package";

let coachUserId = "";
let coacheeUserId = "";
let programId = "";
let listingPackageId = "";

test.describe("Coach · Assign Activity · Assign Program to coachee", () => {
  test.beforeAll(async () => {
    const [coach, coachee] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE.number),
    ]);
    if (!coach || !coachee) throw new Error("Required fixture users missing.");
    coachUserId = coach.id;
    coacheeUserId = coachee.id;

    // Ensure a published+public+listing-attached program exists. The Assign
    // Activities page filters to `isPublishedPublic`, and (per product rule)
    // a public published item needs a listing package wired up to it.
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

    // Top up Shilpa's wallet so she can afford the assign (program costs
    // creditsRequired=50 per bootstrap defaults).
    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: 200,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    if (programId && coacheeUserId) {
      const db = getAdminDb();
      const snap = await db
        .collection("assignments")
        .where("activityId", "==", programId)
        .where("assigneeId", "==", coacheeUserId)
        .get();
      for (const d of snap.docs) await d.ref.delete();
    }
  });

  test("Coach assigns the target Program to Kiran via AssignmentModal", async ({ page }) => {
    // The AssignmentModal fires window.alert("The program has been assigned")
    // on success. Capture and dismiss it; also assert it actually fired.
    let assignedAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/has been assigned/i.test(dialog.message())) {
        assignedAlertSeen = true;
      }
      await dialog.dismiss();
    });

    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/assign-activity", { waitUntil: "domcontentloaded" });

    // Programs tab is default. Find the program card and open Detail Modal.
    const programCard = page.locator("article", { hasText: PROGRAM_NAME }).first();
    await expect(programCard).toBeVisible({ timeout: 30_000 });
    await programCard.getByRole("button", { name: /^Find Out More$/ }).click();

    // Detail Modal opens; click "Assign".
    await page.getByRole("button", { name: /^Assign$/ }).click();

    // AssignmentModal: scope all clicks to it so we don't clash with the
    // page-level Search button or other Assign buttons.
    // Both DetailModal and AssignmentModal render with `class*="backdrop"`.
    // After clicking Assign in DetailModal, the AssignmentModal opens on top.
    // Take the last backdrop (LIFO stack — the AssignmentModal).
    const modal = page.locator('[class*="backdrop"]').last();
    await expect(modal.locator("#phoneOrEmail")).toBeVisible({ timeout: 15_000 });
    await modal.locator("#phoneOrEmail").fill(`+91${COACHEE.number}`);
    await modal.getByRole("button", { name: /^Search$/ }).click();

    // Found stage → Continue.
    await expect(modal.getByRole("button", { name: /^Continue$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Continue$/ }).click();

    // Confirm stage → Assign.
    await modal.getByRole("button", { name: /^Assign$/ }).click();

    // Wait for the success alert to fire (set by the dialog handler).
    await expect.poll(() => assignedAlertSeen, { timeout: 30_000 }).toBe(true);

    // Verify in DB.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", programId)
      .where("assigneeId", "==", coacheeUserId)
      .get();
    expect(snap.docs, "expected one assignment for the test program → Kiran").toHaveLength(1);
    const data = snap.docs[0]!.data();
    expect(String(data.activityType ?? "")).toBe("program");
    expect(String(data.assignerId ?? "")).toBe(coachUserId);
  });
});
