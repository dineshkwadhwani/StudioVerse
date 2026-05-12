/**
 * SA-B1 — SuperAdmin approves a Coach's promotion request.
 *
 * Bootstrap: a published program (listing-package attached so it satisfies
 * the public+published filter), a promotion package, and the program's
 * promotion fields set as if the Coach already requested it
 * (`promotionStatus="requested"`, `promotionRequestedBy=<coachUid>`). The
 * Coach's wallet is topped up to cover the package cost — the approval
 * transaction debits the requester's wallet.
 *
 * SA navigates Approve Requests → Promotion tab → Approve. We verify the
 * program's `promotionStatus` flips to "promoted".
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapDraftProgram,
  bootstrapListingPackage,
  bootstrapPromotionPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
  setProgramPromotionRequested,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa — the simulated requester
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Tier1 Promotion-Request Program";
const LISTING_PACKAGE_NAME = "Tier1 Promotion Listing Package";
const PROMOTION_PACKAGE_NAME = "Tier1 Promotion Package";
const PROMOTION_COST = 75; // matches bootstrapPromotionPackage default

let coachUserId = "";
let programId = "";
let listingPackageId = "";
let promotionPackageId = "";

test.describe("SuperAdmin · Approve Requests · Promotion", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;

    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PACKAGE_NAME);

    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    promotionPackageId = await bootstrapPromotionPackage({
      name: PROMOTION_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    programId = await bootstrapDraftProgram({
      name: PROGRAM_NAME,
      tenantId: TENANT_ID,
      publish: true,
      listingPackageId,
    });
    await setProgramPromotionRequested({
      programId,
      promotionPackageId,
      requesterId: coachUserId,
    });

    // Approval debits the requester's wallet. Make sure Shilpa has enough.
    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: PROMOTION_COST + 50,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PACKAGE_NAME);
  });

  test("SA approves the promotion → program's promotionStatus becomes 'promoted'", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    // Promotion tab is the default. Click for stability.
    await page.getByRole("button", { name: /Promotion/ }).first().click();

    // Scope the click to our program's article — other stale pending
    // requests may exist in the list, and clicking the page's first Approve
    // would then operate on someone else's request.
    const ourCard = page
      .getByText(PROGRAM_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourCard).toBeVisible({ timeout: 30_000 });
    await ourCard.getByRole("button", { name: /^Approve$/ }).click();

    // Wait for the click handler to finish (button leaves "Approving..." state).
    await expect(page.getByRole("button", { name: /^Approving/ })).toHaveCount(0, {
      timeout: 30_000,
    });

    // Surface any error the section set after the call returned.
    const errs = (await page.locator('[class*="error"]').allTextContents()).filter(Boolean);
    if (errs.length) console.log("[debug] surfaced errors after Approve:", errs);

    const db = getAdminDb();
    let status = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("programs").doc(programId).get();
      status = String(snap.data()?.promotionStatus ?? "");
      if (status === "promoted") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected promotionStatus to be 'promoted'").toBe("promoted");
  });
});
