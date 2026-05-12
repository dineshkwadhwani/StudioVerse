/**
 * SA-B4 — SuperAdmin approves a Listing Request for a Program.
 *
 * Bootstrap a program in the `listingStatus="requested"` /
 * `publicationState="pending_publication_review"` state — as if a Coach had
 * submitted it for SA review — with the program's `updatedBy` set to the
 * Coach so the approval transaction debits the Coach's wallet.
 *
 * SA navigates: profile → Approve Requests → Listing tab → Approve.
 *
 * Verifies:
 *   • Program listingStatus flips to "approved".
 *   • publicationState flips to "published".
 *   • A walletTransactions debit row appears for the Coach with reason
 *     "Listing approval charge (program)".
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
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa — simulated requester
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Tier2 Listing-Request Program";
const LISTING_PACKAGE_NAME = "Tier2 Listing Package";
const LISTING_COST = 50; // matches bootstrapListingPackage default

let coachUserId = "";
let programId = "";
let listingPackageId = "";

async function setProgramListingRequested(args: {
  programId: string;
  listingPackageId: string;
  requesterId: string;
}): Promise<void> {
  const db = getAdminDb();
  await db.collection("programs").doc(args.programId).update({
    listingPackageId: args.listingPackageId,
    listingStatus: "requested",
    publicationState: "pending_publication_review",
    status: "pending_publication_review",
    updatedBy: args.requesterId,
    createdBy: args.requesterId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

test.describe("SuperAdmin · Approve Requests · Listing", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;

    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);

    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });

    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: LISTING_COST + 50,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    programId = await bootstrapDraftProgram({
      name: PROGRAM_NAME,
      tenantId: TENANT_ID,
      publish: false,
      listingPackageId,
    });
    await setProgramListingRequested({
      programId,
      listingPackageId,
      requesterId: coachUserId,
    });
  });

  test("SA approves the listing → listingStatus=approved + publicationState=published", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    await page.getByRole("button", { name: /^Listing$/ }).first().click();

    const ourCard = page
      .getByText(PROGRAM_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourCard).toBeVisible({ timeout: 30_000 });
    await ourCard.getByRole("button", { name: /^Approve$/ }).click();

    await expect(page.getByRole("button", { name: /^Approving/ })).toHaveCount(0, {
      timeout: 30_000,
    });

    // Poll DB for status flip.
    const db = getAdminDb();
    let listingStatus = "";
    let publicationState = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("programs").doc(programId).get();
      listingStatus = String(snap.data()?.listingStatus ?? "");
      publicationState = String(snap.data()?.publicationState ?? "");
      if (listingStatus === "approved" && publicationState === "published") break;
      await page.waitForTimeout(1_000);
    }
    expect(listingStatus).toBe("approved");
    expect(publicationState).toBe("published");

    // Wallet debit for the requester.
    const txSnap = await db
      .collection("walletTransactions")
      .where("userId", "==", coachUserId)
      .where("transactionType", "==", "debit")
      .get();
    const hasListingCharge = txSnap.docs.some((d) =>
      /Listing approval charge/i.test(String(d.data().reason ?? ""))
    );
    expect(hasListingCharge, "expected a walletTransactions debit for listing approval").toBe(true);
  });
});
