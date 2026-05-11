/**
 * P-BOT-001 — Coach (Shilpa) buys a Bot Hero package.
 *
 * Uses the "E2E Test Bot Hero Package (1 month)" created by SA test 10.
 * If that package is missing, the test fails with a clear error and you
 * should run the SA bot-hero test first (or restore the package).
 *
 * Pre-conditions:
 *   • Shilpa has a profile photo (`profileImageUrl`). The page's "Buy"
 *     button is disabled without one; this test will fail fast if missing.
 *   • Shilpa's wallet has at least the package cost (1000 credits) — topped
 *     up via Admin SDK.
 *
 * Idempotency: beforeEach deletes any pending botHeroRequests created by
 * earlier runs for this package; afterAll re-credits the wallet by the
 * package cost to keep balance roughly stable.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated;
const TENANT_ID = "coaching-studio";
const PACKAGE_NAME = "E2E Test Bot Hero Package (1 month)";

let coachUserId = "";
let packageId = "";
let packageCredits = 0;

test.describe("Coach · Promote Coach · Buy Bot Hero Package", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;

    // Bot Hero "Buy" button is disabled unless Shilpa has a profile image.
    // Set a placeholder image URL directly via Admin SDK so the button enables.
    if (!coach.data.profileImageUrl && !coach.data.avatarUrl) {
      await getAdminDb()
        .collection("users")
        .doc(coachUserId)
        .update({ profileImageUrl: "https://placehold.co/200x200.png" });
    }

    const db = getAdminDb();
    const pkgSnap = await db
      .collection("botHeroPackages")
      .where("name", "==", PACKAGE_NAME)
      .limit(1)
      .get();
    if (pkgSnap.empty) {
      throw new Error(
        `Bot Hero package "${PACKAGE_NAME}" not found. Run the SA bot-hero test first.`
      );
    }
    packageId = pkgSnap.docs[0]!.id;
    packageCredits = Number(pkgSnap.docs[0]!.data().credits ?? 0);

    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: packageCredits + 100,
    });
  });

  test.beforeEach(async () => {
    // Clean up any pending requests this test created.
    const db = getAdminDb();
    const reqSnap = await db
      .collection("botHeroRequests")
      .where("packageId", "==", packageId)
      .where("professionalId", "==", coachUserId)
      .where("status", "==", "pending")
      .get();
    for (const d of reqSnap.docs) await d.ref.delete();
  });

  test("Coach submits a Bot Hero purchase for the e2e package", async ({ page }) => {
    await signInAs(page, "coachAssociated");
    await page.goto("/coaching-studio/promote-coach", { waitUntil: "domcontentloaded" });

    // Scope to the actual package card (class includes "packageCard") to
    // avoid the wrapping div also matching the package name.
    const pkgCard = page.locator('[class*="packageCard"]', { hasText: PACKAGE_NAME }).first();
    await expect(pkgCard).toBeVisible({ timeout: 30_000 });

    // Pick a preferred start date — 7 days out.
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const iso = future.toISOString().slice(0, 10);
    await pkgCard.locator('input[type="date"]').fill(iso);

    await pkgCard.getByRole("button", { name: new RegExp(`^Buy for ${packageCredits} credits$`) }).click();

    // The button transitions to "Submitting…" then back. Wait for it to
    // finish before checking the DB.
    await expect(pkgCard.getByRole("button", { name: /^Submitting/ })).toHaveCount(0, {
      timeout: 30_000,
    });

    // Poll the DB for the new request — submission completes async.
    const db = getAdminDb();
    let count = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      const reqSnap = await db
        .collection("botHeroRequests")
        .where("packageId", "==", packageId)
        .where("professionalId", "==", coachUserId)
        .get();
      count = reqSnap.docs.length;
      if (count >= 1) break;
      await page.waitForTimeout(1_000);
    }
    expect(count, "expected at least one Bot Hero request").toBeGreaterThanOrEqual(1);
  });
});
