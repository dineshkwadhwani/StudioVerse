/**
 * E2E-3 — Coin transfer end-to-end.
 *
 * Multi-actor scenario:
 *   1. Coach (Shilpa) signs in → /request-coins → submits a coin request to
 *      her company (Narendra).
 *   2. Sign-out + sign-in as Company.
 *   3. Company opens Manage Wallet → View Credit Requests → Approve.
 *   4. Verify: coinRequest status="approved", Company wallet decremented,
 *      Coach wallet incremented, two walletTransactions (sent + received)
 *      exist for the pair.
 *
 * Delta-based assertions so multiple runs don't break each other.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
  getWalletStateForUser,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COMPANY = TEST_PHONES.company; // Narendra
const TENANT_ID = "coaching-studio";
const AMOUNT = 30;

let coachUserId = "";
let companyUserId = "";

async function clearPendingCoinRequests(): Promise<void> {
  const db = getAdminDb();
  const snap = await db
    .collection("coinRequests")
    .where("requesterProfessionalId", "==", coachUserId)
    .where("status", "==", "pending")
    .get();
  for (const d of snap.docs) await d.ref.delete();
}

test.describe("E2E-3 · Coin transfer (Coach requests → Company approves)", () => {
  test.beforeAll(async () => {
    const [c, p] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COMPANY.number),
    ]);
    if (!c || !p) throw new Error("Required fixture users missing.");
    coachUserId = c.id;
    companyUserId = p.id;

    // Company must be able to cover the transfer.
    await ensureWalletAtLeast({
      userId: companyUserId,
      tenantId: TENANT_ID,
      userType: "company",
      userName: COMPANY.fullName,
      minCoins: AMOUNT + 100,
    });
  });

  test.beforeEach(clearPendingCoinRequests);
  test.afterEach(clearPendingCoinRequests);

  test("Coach submits, Company approves, both wallets + ledger entries reconcile", async ({
    page,
  }) => {
    // ── Snapshot wallets before ──────────────────────────────────────────
    const coachBefore = await getWalletStateForUser(coachUserId);
    const companyBefore = await getWalletStateForUser(companyUserId);
    const coachAvailBefore = Number(coachBefore.wallet?.availableCoins ?? 0);
    const companyAvailBefore = Number(companyBefore.wallet?.availableCoins ?? 0);
    const coachTxnsBefore = coachBefore.transactions.length;
    const companyTxnsBefore = companyBefore.transactions.length;

    // ── Step 1 · Coach submits the request ───────────────────────────────
    await signInAs(page, "coachAssociated");
    await page.goto("/coaching-studio/request-coins", { waitUntil: "domcontentloaded" });

    const amountInput = page.locator(
      'xpath=//label[normalize-space()="Number of Coins *"]/following-sibling::input[1]'
    );
    await expect(amountInput).toBeVisible({ timeout: 30_000 });
    await amountInput.fill(String(AMOUNT));

    await page.getByRole("button", { name: /^Submit Request$/ }).click();

    // Wait for the request to land in DB.
    const db = getAdminDb();
    let requestId = "";
    for (let attempt = 0; attempt < 15; attempt++) {
      const snap = await db
        .collection("coinRequests")
        .where("requesterProfessionalId", "==", coachUserId)
        .where("status", "==", "pending")
        .get();
      if (snap.docs.length) {
        requestId = snap.docs[0]!.id;
        break;
      }
      await page.waitForTimeout(1_000);
    }
    expect(requestId, "expected a pending request to be created").not.toBe("");

    // ── Step 2 · Sign out + sign in as Company ───────────────────────────
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });

    await signInAs(page, "company");

    // ── Step 3 · Company approves via Manage Wallet ──────────────────────
    await page.goto("/coaching-studio/manage-wallet", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /View Credit Requests/i }).first().click();
    await expect(page.getByText(COACH.fullName, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Approve$/ }).first().click();

    // Wait for the request status to become approved.
    let status = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("coinRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status === "approved") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected request to be approved").toBe("approved");

    // ── Step 4 · Verify wallets + ledger ─────────────────────────────────
    const coachAfter = await getWalletStateForUser(coachUserId);
    const companyAfter = await getWalletStateForUser(companyUserId);

    expect(Number(coachAfter.wallet?.availableCoins ?? 0)).toBe(coachAvailBefore + AMOUNT);
    expect(Number(companyAfter.wallet?.availableCoins ?? 0)).toBe(companyAvailBefore - AMOUNT);

    // Each side should have exactly one new transaction (received/sent pair).
    expect(coachAfter.transactions.length).toBe(coachTxnsBefore + 1);
    expect(companyAfter.transactions.length).toBe(companyTxnsBefore + 1);

    const newestCoachTxn = coachAfter.transactions
      .slice()
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0]!;
    const newestCompanyTxn = companyAfter.transactions
      .slice()
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0]!;

    expect(String(newestCoachTxn.transactionType ?? "")).toBe("received");
    expect(Number(newestCoachTxn.coins)).toBe(AMOUNT);
    expect(String(newestCompanyTxn.transactionType ?? "")).toBe("sent");
    expect(Number(newestCompanyTxn.coins)).toBe(AMOUNT);
  });
});
