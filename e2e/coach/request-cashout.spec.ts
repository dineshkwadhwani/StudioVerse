/**
 * P-B2 — Coach (Dinesh, independent) submits a Cashout request from
 * Manage Wallet.
 *
 * Cashout is gated on `canCashout = isCompanyUser || isIndependentCoach`,
 * so we must use the independent coach (no associatedCompanyId).
 *
 * Setup:
 *   • Ensure Dinesh has at least 200 credits available (default minimum is
 *     40; we ask for 100 to be safely above).
 *
 * Flow:
 *   1. Dinesh signs in → /coaching-studio/manage-wallet.
 *   2. Click "Cashout Credits" → modal opens.
 *   3. Fill 100 credits + a note → Submit.
 *   4. Modal closes.
 *
 * Verifies:
 *   • A new cashoutRequests doc exists with status="pending",
 *     requesterUserId=Dinesh's uid, creditsRequested=100.
 *
 * Cleanup: delete the freshly-created cashoutRequests doc.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const COACH = TEST_PHONES.coachIndependent; // Dinesh — independent coach
const TENANT_ID = "coaching-studio";
const CREDITS_TO_CASHOUT = 100;
const CASHOUT_NOTE = "Tier2 P-B2 e2e cashout request";

let coachUserId = "";

test.describe("Coach · Manage Wallet · Submit Cashout Request", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;

    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: CREDITS_TO_CASHOUT + 100,
    });

    // The cashout service rejects unless redeemableBalance >= requested.
    // Only credit walletTransactions with sources in REDEEMABLE_SOURCES
    // (earned / purchased / etc.) count. Seed one we control so the test
    // is independent of the user's prior activity.
    await getAdminDb().collection("walletTransactions").add({
      walletId: `${TENANT_ID}::${coachUserId}`,
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      transactionType: "credit",
      source: "earned",
      reason: "Tier2 P-B2 redeemable seed",
      coins: CREDITS_TO_CASHOUT + 100,
      createdBy: "e2e-tier2",
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  test("Independent Coach submits a cashout request → cashoutRequests doc pending", async ({
    page,
  }) => {
    // Snapshot existing pending cashouts for this user so we can identify
    // the new one without conflicting with stale ones.
    const db = getAdminDb();
    const beforeSnap = await db
      .collection("cashoutRequests")
      .where("requesterUserId", "==", coachUserId)
      .get();
    const beforeIds = new Set(beforeSnap.docs.map((d) => d.id));

    await signInAs(page, "coachIndependent");
    await page.goto("/coaching-studio/manage-wallet", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: /^Cashout Credits$/ })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Cashout Credits$/ }).click();

    // Modal — fill the credits + note and submit.
    await expect(page.locator("#cashout-credits-input")).toBeVisible({ timeout: 15_000 });
    await page.locator("#cashout-credits-input").fill(String(CREDITS_TO_CASHOUT));
    await page.locator("#cashout-note-input").fill(CASHOUT_NOTE);
    await page.getByRole("button", { name: /^Submit Cashout Request$/ }).click();

    // Poll DB for a new cashoutRequests doc owned by this user.
    let newDocId = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db
        .collection("cashoutRequests")
        .where("requesterUserId", "==", coachUserId)
        .get();
      const fresh = snap.docs.find((d) => !beforeIds.has(d.id));
      if (fresh) {
        newDocId = fresh.id;
        break;
      }
      await page.waitForTimeout(1_000);
    }
    expect(newDocId, "expected a new cashoutRequests doc").not.toBe("");

    const cashoutData = (await db.collection("cashoutRequests").doc(newDocId).get()).data() ?? {};
    expect(String(cashoutData.status ?? "")).toBe("pending");
    expect(Number(cashoutData.creditsRequested ?? 0)).toBe(CREDITS_TO_CASHOUT);
    expect(String(cashoutData.tenantId ?? "")).toBe(TENANT_ID);

    // Cleanup the newly-created doc.
    await db.collection("cashoutRequests").doc(newDocId).delete().catch(() => {});
  });
});
