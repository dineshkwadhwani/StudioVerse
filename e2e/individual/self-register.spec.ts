/**
 * I-SELF-001 — Individual (Kiran) self-registers for a Program via Try Now / Register Now.
 *
 * Flow:
 *   1. Kiran signs in.
 *   2. Navigates /coaching-studio/programs.
 *   3. Clicks "Find out more..." on the test program.
 *   4. In DetailModal clicks "Register Now" → opens AssignmentModal in
 *      selfAssign mode (no search step; goes straight to confirm).
 *   5. AssignmentModal's primary button confirms the self-assignment.
 *
 * Expected: a new `assignments/` doc for this (program × Kiran).
 *
 * Idempotency: beforeEach deletes any prior self-assignment.
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

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Individual Self-Register Program";
const LISTING_PACKAGE_NAME = "Individual Self-Register Listing Package";

let individualUserId = "";
let programId = "";
let listingPackageId = "";

test.describe("Individual · Programs · Register Now (self-assign)", () => {
  test.beforeAll(async () => {
    const ind = await getUserByPhone(INDIVIDUAL.number);
    if (!ind) throw new Error("Kiran (individual) fixture missing.");
    individualUserId = ind.id;

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

    // Top up Kiran's wallet so she can pay the program cost (creditsRequired=50).
    await ensureWalletAtLeast({
      userId: individualUserId,
      tenantId: TENANT_ID,
      userType: "individual",
      userName: INDIVIDUAL.fullName,
      minCoins: 200,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    if (programId && individualUserId) {
      const db = getAdminDb();
      const snap = await db
        .collection("assignments")
        .where("activityId", "==", programId)
        .where("assigneeId", "==", individualUserId)
        .get();
      for (const d of snap.docs) await d.ref.delete();
    }
  });

  test("Individual self-registers for a Program via Register Now", async ({ page }) => {
    let registeredAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/has been assigned/i.test(dialog.message())) {
        registeredAlertSeen = true;
      }
      await dialog.dismiss();
    });

    await signInAs(page, "individualAssociated");

    await page.goto("/coaching-studio/programs", { waitUntil: "domcontentloaded" });

    const card = page.locator("article", { hasText: PROGRAM_NAME }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole("button", { name: /^Find out more/i }).click();

    // DetailModal → Register Now.
    const detail = page.locator('[class*="backdrop"]');
    await detail.getByRole("button", { name: /^Register Now$/ }).click();

    // AssignmentModal opens on top in selfAssign mode → primary button "Assign".
    const modal = page.locator('[class*="backdrop"]').last();
    await modal.getByRole("button", { name: /^Assign$/ }).click();

    await expect.poll(() => registeredAlertSeen, { timeout: 30_000 }).toBe(true);

    // Verify.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", programId)
      .where("assigneeId", "==", individualUserId)
      .get();
    expect(snap.docs).toHaveLength(1);
    const data = snap.docs[0]!.data();
    expect(String(data.activityType ?? "")).toBe("program");
    expect(String(data.assigneeId ?? "")).toBe(individualUserId);
    // For self-assignment, the assigner should also be the individual.
    expect(String(data.assignerId ?? "")).toBe(individualUserId);
  });
});
