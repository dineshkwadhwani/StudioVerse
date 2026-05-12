/**
 * SA-B6 — SuperAdmin opens the Wallet Details modal for a real user
 * and sees the wallet snapshot + transaction ledger.
 *
 * Pre-seed a uniquely-tagged walletTransactions row for Shilpa via Admin
 * SDK so we can deterministically assert it shows up in the SA view.
 *
 * Flow:
 *   1. Ensure Shilpa has a wallet (top up if missing).
 *   2. Seed a "credit" transaction with a unique reason string.
 *   3. SA signs in → Manage Wallet.
 *   4. Filter Professional → find Shilpa's wallet row → View Details.
 *   5. Verify modal: Available/Utilized/Issued labels + our seeded reason
 *      appears in the transaction list.
 *
 * Cleanup: delete the seeded transaction.
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

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const TENANT_ID = "coaching-studio";
const UNIQUE_REASON = `Tier2 SA-B6 ledger probe ${Date.now()}`;

let coachUserId = "";
let seededTxnId = "";

test.describe("SuperAdmin · Manage Wallet · View Details", () => {
  test.beforeAll(async () => {
    const coach = await getUserByPhone(COACH.number);
    if (!coach) throw new Error("Coach fixture missing.");
    coachUserId = coach.id;

    await ensureWalletAtLeast({
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      minCoins: 100,
    });

    const db = getAdminDb();
    const walletId = `${TENANT_ID}::${coachUserId}`;
    const txnRef = db.collection("walletTransactions").doc();
    await txnRef.set({
      walletId,
      userId: coachUserId,
      tenantId: TENANT_ID,
      userType: "professional",
      userName: COACH.fullName,
      transactionType: "credit",
      source: "manual",
      reason: UNIQUE_REASON,
      coins: 1,
      createdBy: "e2e-tier2",
      createdAt: FieldValue.serverTimestamp(),
    });
    seededTxnId = txnRef.id;
  });

  test.afterAll(async () => {
    if (seededTxnId) {
      await getAdminDb()
        .collection("walletTransactions")
        .doc(seededTxnId)
        .delete()
        .catch(() => {});
    }
  });

  test("SA sees Shilpa's wallet snapshot + the seeded ledger entry", async ({ page }) => {
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Wallet$/ }).first().click();

    // Filter to professional wallets so the list is short.
    await page.getByRole("radio", { name: /^Professional$/ }).check();

    // Scope to Shilpa's wallet row by her name, then click View Details.
    const ourRow = page
      .getByText(COACH.fullName, { exact: true })
      .first()
      .locator("xpath=ancestor::section[1]");
    await expect(ourRow).toBeVisible({ timeout: 30_000 });
    await ourRow.getByRole("button", { name: /^View Details$/ }).click();

    // The wallet details modal renders three snapshot cards.
    await expect(
      page.getByRole("heading", { name: new RegExp(`${COACH.fullName} - Wallet Details`) })
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Available", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Utilized", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Total Issued", { exact: true }).first()).toBeVisible();

    // Our seeded transaction reason should appear in the modal ledger.
    await expect(page.getByText(UNIQUE_REASON)).toBeVisible({ timeout: 15_000 });
  });
});
