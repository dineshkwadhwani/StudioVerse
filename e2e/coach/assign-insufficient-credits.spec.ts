/**
 * P-NEG-1 — Coach assignment fails when wallet < credits required.
 *
 * Bootstrap a program that costs 50 credits, then force Shilpa's wallet to
 * 10 credits. Driving the AssignmentModal through to Assign should fail
 * with an inline "Not enough coins" error and NO assignments doc is
 * written.
 *
 * To avoid breaking other tests that rely on Shilpa having credits, we
 * snapshot her wallet's availableCoins in beforeAll and restore it in
 * afterAll. The transaction history is left as-is.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapDraftProgram,
  bootstrapListingPackage,
  deleteDocsWhere,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COACHEE = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Tier2 Insufficient-Credits Program";
const LISTING_PACKAGE_NAME = "Tier2 Insufficient-Credits Listing";
const PROGRAM_COST = 50;
const FORCED_BALANCE = 10;

let coachUserId = "";
let coacheeUserId = "";
let programId = "";
let listingPackageId = "";
let walletPath = "";
let savedAvailable = 0;
let savedUtilized = 0;

test.describe("Coach · Assign Activity · Insufficient credits (negative)", () => {
  test.beforeAll(async () => {
    const [coach, coachee] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COACHEE.number),
    ]);
    if (!coach || !coachee) throw new Error("Required fixture users missing.");
    coachUserId = coach.id;
    coacheeUserId = coachee.id;

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

    // Snapshot Shilpa's wallet, then force it below the assign cost.
    const db = getAdminDb();
    walletPath = `${TENANT_ID}::${coachUserId}`;
    const walletRef = db.collection("wallets").doc(walletPath);
    const snap = await walletRef.get();
    if (!snap.exists) {
      await walletRef.set({
        userId: coachUserId,
        tenantId: TENANT_ID,
        userType: "professional",
        userName: COACH.fullName,
        totalIssuedCoins: FORCED_BALANCE,
        utilizedCoins: 0,
        availableCoins: FORCED_BALANCE,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      savedAvailable = 0;
      savedUtilized = 0;
    } else {
      const data = snap.data()!;
      savedAvailable = Number(data.availableCoins ?? 0);
      savedUtilized = Number(data.utilizedCoins ?? 0);
      await walletRef.update({
        availableCoins: FORCED_BALANCE,
        utilizedCoins: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  test.afterAll(async () => {
    if (walletPath) {
      // Restore the snapshot so other tests keep their assumed balance.
      await getAdminDb().collection("wallets").doc(walletPath).update({
        availableCoins: savedAvailable,
        utilizedCoins: savedUtilized,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    // Drop any stale assignment from a prior failed run.
    if (programId && coacheeUserId) {
      const snap = await getAdminDb()
        .collection("assignments")
        .where("activityId", "==", programId)
        .where("assigneeId", "==", coacheeUserId)
        .get();
      for (const d of snap.docs) await d.ref.delete();
    }
  });

  test("Assigning a 50-cost program with only 10 coins surfaces a Not-enough-coins error and writes nothing", async ({
    page,
  }) => {
    // The error path stays inline in the modal — no window.alert. But we
    // still capture any dialog defensively so it doesn't block the test.
    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });

    await signInAs(page, "coachAssociated");
    await page.goto("/coaching-studio/assign-activity", { waitUntil: "domcontentloaded" });

    const programCard = page.locator("article", { hasText: PROGRAM_NAME }).first();
    await expect(programCard).toBeVisible({ timeout: 30_000 });
    await programCard.getByRole("button", { name: /^Find Out More$/ }).click();

    await page.getByRole("button", { name: /^Assign$/ }).click();

    const modal = page.locator('[class*="backdrop"]').last();
    await expect(modal.locator("#phoneOrEmail")).toBeVisible({ timeout: 15_000 });
    await modal.locator("#phoneOrEmail").fill(`+91${COACHEE.number}`);
    await modal.getByRole("button", { name: /^Search$/ }).click();

    await expect(modal.getByRole("button", { name: /^Continue$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Continue$/ }).click();

    await modal.getByRole("button", { name: /^Assign$/ }).click();

    // Error message renders inline inside the modal.
    await expect(
      modal.getByText(/Not enough coins\. Required: 50, Available: 10/)
    ).toBeVisible({ timeout: 15_000 });

    // Verify no assignment was written.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", programId)
      .where("assigneeId", "==", coacheeUserId)
      .get();
    expect(snap.docs, "expected no assignment doc on insufficient-credits path").toHaveLength(0);
  });
});
