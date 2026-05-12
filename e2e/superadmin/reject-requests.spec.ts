/**
 * SA-B5 — SuperAdmin rejects pending requests across three flows:
 *   a) Promotion — Deny on Approve Requests → Promotion tab.
 *      Verify: program.promotionStatus flips from "requested" → "none".
 *   b) Bot Hero — Deny on Approve Requests → Bot Hero tab.
 *      Verify: botHeroRequests doc status flips from "pending" → "denied".
 *   c) Cashout — Deny on Approve Requests → Cash Out tab (requires denial
 *      reason in textarea).
 *      Verify: cashoutRequests doc status flips from "pending" → "denied".
 *
 * Each test bootstraps its own pending request, clicks Deny, polls for the
 * status change. Cohabits in one spec to keep the SA-B5 scope coherent.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapBotHeroRequest,
  bootstrapCashoutRequest,
  bootstrapDraftProgram,
  bootstrapListingPackage,
  bootstrapPromotionPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
  setProgramPromotionRequested,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const TENANT_ID = "coaching-studio";

const PROGRAM_NAME = "Tier2 Reject-Promotion Program";
const PROMOTION_PKG_NAME = "Tier2 Reject Promotion Package";
const LISTING_PKG_NAME = "Tier2 Reject Listing Package";
const BOT_HERO_PKG_NAME = "Tier2 Reject Bot Hero Package";

let coachUserId = "";

async function clickTabByLabel(page: import("@playwright/test").Page, label: string) {
  await page
    .getByRole("button")
    .filter({ hasText: new RegExp(`^${label}\\s*\\d*$`) })
    .first()
    .click();
}

test.describe("SuperAdmin · Approve Requests · Reject flows", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;
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
    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PKG_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PKG_NAME);
    await deleteDocsWhere("botHeroPackages", "name", BOT_HERO_PKG_NAME);
  });

  test("SA denies a pending Promotion request → promotionStatus = 'none'", async ({ page }) => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PKG_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PKG_NAME);

    const listingPkgId = await bootstrapListingPackage({
      name: LISTING_PKG_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    const promotionPkgId = await bootstrapPromotionPackage({
      name: PROMOTION_PKG_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    const programId = await bootstrapDraftProgram({
      name: PROGRAM_NAME,
      tenantId: TENANT_ID,
      publish: true,
      listingPackageId: listingPkgId,
    });
    await setProgramPromotionRequested({
      programId,
      promotionPackageId: promotionPkgId,
      requesterId: coachUserId,
    });

    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    await clickTabByLabel(page, "Promotion");

    const ourCard = page
      .getByText(PROGRAM_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourCard).toBeVisible({ timeout: 30_000 });
    await ourCard.getByRole("button", { name: /^Deny$/ }).click();

    const db = getAdminDb();
    let status = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("programs").doc(programId).get();
      status = String(snap.data()?.promotionStatus ?? "");
      if (status === "none") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected promotionStatus → 'none' after Deny").toBe("none");
  });

  test("SA denies a pending Bot Hero request → status = 'denied'", async ({ page }) => {
    await deleteDocsWhere("botHeroPackages", "name", BOT_HERO_PKG_NAME);
    const db = getAdminDb();
    const pkgRef = db.collection("botHeroPackages").doc();
    await pkgRef.set({
      name: BOT_HERO_PKG_NAME,
      description: "Tier2 reject bot hero package",
      imageUrl: "https://placehold.co/200x200.png",
      imagePath: "",
      durationValue: 2,
      durationUnit: "weeks",
      credits: 500,
      active: true,
      sortOrder: 99,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const packageId = pkgRef.id;

    const requestId = await bootstrapBotHeroRequest({
      tenantId: TENANT_ID,
      professionalId: coachUserId,
      professionalName: COACH.fullName,
      packageId,
      packageName: BOT_HERO_PKG_NAME,
      durationValue: 2,
      durationUnit: "weeks",
      credits: 500,
    });

    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    await clickTabByLabel(page, "Bot Hero");

    const ourCard = page
      .getByText(BOT_HERO_PKG_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourCard).toBeVisible({ timeout: 30_000 });
    await ourCard.getByRole("button", { name: /^Deny$/ }).click();

    let status = "pending";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("botHeroRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status !== "pending") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected bot hero status → 'denied'").toBe("denied");

    await db.collection("botHeroRequests").doc(requestId).delete().catch(() => {});
  });

  test("SA denies a pending Cashout request → status = 'denied' (with denial reason)", async ({
    page,
  }) => {
    // Clear any stale pending cashouts left by prior failed runs for this
    // user, so the SA list only contains our bootstrapped one.
    const preStale = await getAdminDb()
      .collection("cashoutRequests")
      .where("requesterUserId", "==", coachUserId)
      .where("status", "==", "pending")
      .get();
    for (const d of preStale.docs) await d.ref.delete();

    const requestId = await bootstrapCashoutRequest({
      tenantId: TENANT_ID,
      requesterUserId: coachUserId,
      requesterName: COACH.fullName,
      amount: 25,
    });

    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    await clickTabByLabel(page, "Cash Out");

    // Scope by the unique textarea id so we hit the exact bootstrapped row,
    // not any stale Shilpa-cashout left over from a prior run.
    const reasonInput = page.locator(`#deny-reason-${requestId}`);
    await expect(reasonInput).toBeVisible({ timeout: 30_000 });
    const ourCard = reasonInput.locator("xpath=ancestor::article[1]");

    await reasonInput.fill("E2E rejection: test cleanup");
    await expect(reasonInput).toHaveValue("E2E rejection: test cleanup");
    await ourCard.getByRole("button", { name: /^Deny$/ }).click();

    const db = getAdminDb();
    let status = "pending";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("cashoutRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status !== "pending") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected cashout status → 'denied'").toBe("denied");

    await db.collection("cashoutRequests").doc(requestId).delete().catch(() => {});
  });
});
