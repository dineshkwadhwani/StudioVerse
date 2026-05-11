/**
 * SA-WAL-001 — SuperAdmin assigns credits to Company, Coach, and Individual.
 *
 * For each of the three named non-SA users we:
 *   1. Snapshot the wallet via Firebase Admin SDK.
 *   2. Use the SA portal "Wallet" page to assign 500 credits.
 *   3. Assert the wallet's totalIssued and available both grew by exactly 500
 *      and a fresh "credit" walletTransaction for 500 was written.
 *
 * The test uses delta-based assertions — assigned credits cannot be cleanly
 * "undone", so we measure deltas rather than absolute balances. Every run
 * adds another +500 to each of the three wallets in studioverse-test.
 */

import { test, expect, type Page } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getUserByPhone,
  getWalletStateForUser,
} from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const COINS = 500;

type Target = {
  key: "company" | "coachIndependent" | "individualIndependent";
  userTypeOption: "company" | "professional" | "individual";
};

const TARGETS: Target[] = [
  { key: "company", userTypeOption: "company" },
  { key: "coachIndependent", userTypeOption: "professional" },
  { key: "individualIndependent", userTypeOption: "individual" },
];

async function openSuperAdminWalletMenu(page: Page): Promise<void> {
  // signInAs(superAdmin) lands us on the /admin portal already.
  await page.locator('button[class*="profileButton"]').first().click();
  await page.getByRole("button", { name: /^Wallet$/ }).first().click();
  // Form on the Wallet page anchors on the tenant select.
  await expect(page.locator("#coins-tenant")).toBeVisible({ timeout: 15_000 });
}

async function assignCreditsViaUi(
  page: Page,
  args: {
    userTypeOption: Target["userTypeOption"];
    userName: string;
    coins: number;
  }
): Promise<void> {
  await page.selectOption("#coins-tenant", TENANT_ID);
  await page.selectOption("#coins-user-type", args.userTypeOption);

  // User dropdown is populated asynchronously after tenant + type are set.
  const userSelect = page.locator("#coins-user");
  await expect(userSelect.locator(`option:has-text("${args.userName}")`)).toHaveCount(1, {
    timeout: 15_000,
  });
  await userSelect.selectOption({ label: args.userName });

  await page.fill("#coins-count", String(args.coins));
  await page.getByRole("button", { name: /^Assign Credits$/ }).click();

  // Wait for the success info message.
  await expect(
    page.getByText(new RegExp(`Assigned ${args.coins} coins to ${args.userName}`, "i")).first()
  ).toBeVisible({ timeout: 20_000 });
}

test.describe("SuperAdmin · Wallet · Assign Credits", () => {
  for (const target of TARGETS) {
    const targetPhone = TEST_PHONES[target.key];

    test(`SA assigns ${COINS} credits to ${targetPhone.role} (${targetPhone.fullName})`, async ({
      page,
    }) => {
      // 1. Snapshot wallet state before the action.
      const user = await getUserByPhone(targetPhone.number);
      expect(user, `expected pre-existing user for ${targetPhone.number}`).not.toBeNull();
      const before = await getWalletStateForUser(user!.id);
      expect(before.wallet, "expected pre-existing wallet").not.toBeNull();

      const issuedBefore = Number(before.wallet!.totalIssuedCoins ?? 0);
      const availableBefore = Number(before.wallet!.availableCoins ?? 0);
      const utilizedBefore = Number(before.wallet!.utilizedCoins ?? 0);
      const txnsBefore = before.transactions.length;

      // 2. Sign in and drive the SA UI.
      await signInAs(page, "superAdmin");
      await openSuperAdminWalletMenu(page);
      await assignCreditsViaUi(page, {
        userTypeOption: target.userTypeOption,
        userName: targetPhone.fullName,
        coins: COINS,
      });

      // 3. Assert the wallet's totalIssued and available grew by exactly COINS
      //    and utilized stayed the same.
      const after = await getWalletStateForUser(user!.id);
      expect(after.wallet, "wallet should still exist post-assign").not.toBeNull();

      expect(Number(after.wallet!.totalIssuedCoins)).toBe(issuedBefore + COINS);
      expect(Number(after.wallet!.availableCoins)).toBe(availableBefore + COINS);
      expect(Number(after.wallet!.utilizedCoins)).toBe(utilizedBefore);

      // 4. Assert a fresh credit txn for COINS was written.
      expect(after.transactions.length).toBe(txnsBefore + 1);

      const newTxn = after.transactions
        .slice()
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? 0;
          const bMs = b.createdAt?.toMillis?.() ?? 0;
          return bMs - aMs;
        })[0]!;

      expect(newTxn.transactionType).toBe("credit");
      expect(Number(newTxn.coins)).toBe(COINS);
      expect(newTxn.tenantId).toBe(TENANT_ID);
      expect(newTxn.userId).toBe(user!.id);
    });
  }
});
