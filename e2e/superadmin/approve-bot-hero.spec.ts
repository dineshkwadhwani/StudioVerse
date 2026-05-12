/**
 * SA-B2 — SuperAdmin approves a Bot Hero request (with start-date pick).
 *
 * Bootstrap a pending bot hero request + the package it references. SA
 * navigates to Approve Requests → Bot Hero tab, picks a future start
 * date, clicks Approve. Verify status flips out of "pending".
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapBotHeroRequest,
  deleteDocsWhere,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const TENANT_ID = "coaching-studio";
const PACKAGE_NAME = "Tier1 Bot Hero Package";

let coachUserId = "";
let packageId = "";
let requestId = "";

test.describe("SuperAdmin · Approve Requests · Bot Hero", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Shilpa fixture missing.");
    coachUserId = coach.id;

    await deleteDocsWhere("botHeroPackages", "name", PACKAGE_NAME);
    const db = getAdminDb();
    const pkgRef = db.collection("botHeroPackages").doc();
    await pkgRef.set({
      name: PACKAGE_NAME,
      description: "Tier1 bot hero package",
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
    packageId = pkgRef.id;
  });

  test.afterAll(async () => {
    await deleteDocsWhere("botHeroPackages", "name", PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    requestId = await bootstrapBotHeroRequest({
      tenantId: TENANT_ID,
      professionalId: coachUserId,
      professionalName: COACH.fullName,
      packageId,
      packageName: PACKAGE_NAME,
      durationValue: 2,
      durationUnit: "weeks",
      credits: 500,
    });
  });

  test.afterEach(async () => {
    if (requestId) {
      await getAdminDb().collection("botHeroRequests").doc(requestId).delete().catch(() => {});
    }
  });

  test("SA approves a pending Bot Hero request after picking a start date", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    await page.getByRole("button", { name: /Bot Hero/ }).first().click();

    // Scope to our specific row by package name (more unique than coach
    // name). Other pending bot-hero requests may exist on the page.
    const ourCard = page
      .getByText(PACKAGE_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourCard).toBeVisible({ timeout: 30_000 });

    // The approval rejects on overlap with any existing approved/active slot.
    // Pick a start date 2 years out.
    const future = new Date();
    future.setDate(future.getDate() + 730);
    await ourCard.locator('input[type="date"]').fill(future.toISOString().slice(0, 10));
    await ourCard.getByRole("button", { name: /^Approve$/ }).click();

    // Poll DB for status change out of "pending".
    const db = getAdminDb();
    let status = "pending";
    for (let attempt = 0; attempt < 15; attempt++) {
      const snap = await db.collection("botHeroRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status && status !== "pending") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected status to move from 'pending'").not.toBe("pending");
  });
});
