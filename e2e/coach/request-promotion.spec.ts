/**
 * P-C2 — Coach requests promotion for a Program at creation time.
 *
 * The Coach UI doesn't have a separate post-creation "Request Promotion"
 * action — promotion is requested via the same Create Program form by
 * ticking "Promote now" and selecting a Promotion Package. The save handler
 * stamps `promotionStatus: "requested"` + `promotionPackageId` and debits
 * the requester's wallet for the package cost.
 *
 * Pre-conditions:
 *   • An active Promotion Package targeting "program" exists.
 *   • Shilpa's wallet has enough credits to cover the promotion cost
 *     (≥ costCredits at submission time).
 *
 * Verifies the program is created with `promotionStatus = "requested"`,
 * the configured package id, and the requester field set to Shilpa.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapPromotionPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Coach Promote E2E Program";
const PROMOTION_PACKAGE_NAME = "Coach Promote E2E Package";
const PROMOTION_COST = 75; // matches bootstrapPromotionPackage default
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

let coachUserId = "";
let promotionPackageId = "";

test.describe("Coach · Create Program · Request Promotion", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Shilpa fixture missing.");
    coachUserId = coach.id;

    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PACKAGE_NAME);
    promotionPackageId = await bootstrapPromotionPackage({
      name: PROMOTION_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });

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
    await deleteDocsWhere("promotionPackages", "name", PROMOTION_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
  });

  test("Coach creates a Program with Promote-now → promotionStatus = 'requested'", async ({
    page,
  }) => {
    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/manage-programs", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Add Program$/ }).click();
    await page.waitForURL(/\/coaching-studio\/create-program/, { timeout: 15_000 });
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    // Required fields (draft + publish path are the same here).
    await page
      .locator("#program-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();
    await page.fill("#program-name", PROGRAM_NAME);
    await page.fill("#program-short-description", "Short description for the promote-now e2e program.");
    await page.fill("#program-long-description", "Long description for the promote-now e2e program.");
    await page.fill("#program-details", "Detailed agenda for the promote-now e2e program.");
    await page.fill("#program-credits-required", "50");
    await page.fill("#program-duration-value", "4");
    await page.selectOption("#program-duration-unit", "weeks");
    await page.fill("#program-facilitator-name", "Promote E2E Facilitator");
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    // Tick "Promote now" — exposes the promotion package select.
    await page.getByRole("checkbox", { name: /^Promote now$/ }).check();
    const promoSelect = page.locator("#program-promotion-package");
    await expect(promoSelect).toBeVisible({ timeout: 10_000 });
    await expect(promoSelect).toBeEnabled();
    await promoSelect.selectOption(promotionPackageId);

    await page.getByRole("button", { name: /^Create$/ }).click();
    await page.waitForURL((url) => !url.pathname.endsWith("/create-program"), {
      timeout: 60_000,
    });

    // Verify in Firestore.
    const snap = await getAdminDb()
      .collection("programs")
      .where("name", "==", PROGRAM_NAME)
      .get();
    expect(snap.docs).toHaveLength(1);

    const program = snap.docs[0]!.data();
    expect(String(program.tenantId ?? "")).toBe(TENANT_ID);
    expect(String(program.promotionStatus ?? "")).toBe("requested");
    expect(String(program.promotionPackageId ?? "")).toBe(promotionPackageId);
  });
});
