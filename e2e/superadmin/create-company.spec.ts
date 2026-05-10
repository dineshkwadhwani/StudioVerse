/**
 * SA-USR-001 — SuperAdmin creates a Company user.
 *
 * Flow under test:
 *   1. SA signs in via phone OTP.
 *   2. SA opens /admin → Users.
 *   3. SA fills the Create User form for userType=company, picks
 *      tenant=coaching-studio, supplies company name + owner name + phone +
 *      email, and submits.
 *
 * Expected post-state (verified directly via Firebase Admin SDK so we don't
 * have to trust the same UI we just used):
 *   • A users/{id} doc exists with userType=company and the supplied phone.
 *   • A wallets/{id} doc exists for that userId.
 *   • A "credit" walletTransaction with reason "Initial wallet issuance"
 *     exists matching the wallet's totalIssuedCoins (i.e. registration coins
 *     were transferred).
 *
 * Idempotency: a beforeEach hook deletes any pre-existing user / wallet /
 * walletTransactions for the test phone, so the test can be re-run safely.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  deleteUserAndWalletByPhone,
  findUsersByPhone,
  getWalletStateForUser,
  toE164India,
} from "../../tests/helpers/admin-firestore";

const COMPANY = TEST_PHONES.companyByAdmin; // 9168676738
const TENANT_ID = "coaching-studio";
const COMPANY_NAME = "Acme E2E Test Co";
const COMPANY_OWNER_NAME = "Acme Owner (e2e)";
const COMPANY_OWNER_EMAIL = "acme-owner-e2e@example.com";

test.describe("SuperAdmin · Users · Create Company", () => {
  test.beforeEach(async () => {
    const summary = await deleteUserAndWalletByPhone(COMPANY.number);
    test
      .info()
      .annotations.push({
        type: "cleanup",
        description:
          `Pre-test cleanup of phone ${COMPANY.number}: ` +
          `${summary.usersDeleted} user(s), ${summary.walletsDeleted} wallet(s), ${summary.txnsDeleted} txn(s) removed.`,
      });
  });

  test("SA creates a Company → user, wallet, and registration coins are provisioned", async ({
    page,
  }) => {
    // 1. Sign in as SuperAdmin.
    await signInAs(page, "superAdminPrimary");

    // 2. Navigate to the SA portal.
    await page.goto("/admin", { waitUntil: "domcontentloaded" });

    // 3. The portal hides menu behind a profile-initials button (with a ▾
    //    caret). Open the menu, then click the "Users" item.
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Users$/ }).first().click();

    // 4. Wait for the Create User form to render.
    await expect(page.locator("#create-user-type")).toBeVisible({ timeout: 15_000 });

    // 5. Fill the form for a Company user.
    await page.selectOption("#create-user-type", "company");

    // Tenant dropdown is populated asynchronously from Firestore; wait for the
    // option for our test tenant before selecting it.
    const tenantSelect = page.locator("#user-tenant-id-input");
    await expect(tenantSelect.locator(`option[value="${TENANT_ID}"]`)).toHaveCount(1, {
      timeout: 15_000,
    });
    await tenantSelect.selectOption(TENANT_ID);

    await page.fill("#user-company-name-input", COMPANY_NAME);
    await page.fill("#user-name-input", COMPANY_OWNER_NAME);
    await page.fill("#user-phone-input", `+91${COMPANY.number}`);
    await page.fill("#user-email-input", COMPANY_OWNER_EMAIL);

    // 6. Submit.
    await page.getByRole("button", { name: /^Create User$/ }).click();

    // 7. Expect the success toast / inline message. The portal renders the
    //    info string in two locations, so take the first match.
    await expect(page.getByText(/User saved/i).first()).toBeVisible({ timeout: 20_000 });

    // 8. Assert post-state via Admin SDK (single source of truth).
    const matches = await findUsersByPhone(COMPANY.number);
    expect(matches, "expected exactly one user doc for the test phone").toHaveLength(1);

    const userDoc = matches[0]!;
    expect(userDoc.data.userType).toBe("company");
    expect(userDoc.data.companyName).toBe(COMPANY_NAME);
    expect(userDoc.data.name).toBe(COMPANY_OWNER_NAME);
    expect(userDoc.data.email).toBe(COMPANY_OWNER_EMAIL);
    expect(userDoc.data.tenantId).toBe(TENANT_ID);
    expect(userDoc.data.phoneE164).toBe(toE164India(COMPANY.number));

    const { wallet, transactions } = await getWalletStateForUser(userDoc.id);

    expect(wallet, "wallet doc should exist for the new company user").not.toBeNull();
    expect(wallet!.tenantId).toBe(TENANT_ID);
    expect(wallet!.userType).toBe("company");
    expect(wallet!.utilizedCoins).toBe(0);
    // available === issued for a freshly minted wallet.
    expect(wallet!.availableCoins).toBe(wallet!.totalIssuedCoins);
    expect(wallet!.totalIssuedCoins).toBeGreaterThanOrEqual(0);

    if (wallet!.totalIssuedCoins > 0) {
      const issuance = transactions.find(
        (t) => t.transactionType === "credit" && /Initial wallet issuance/i.test(String(t.reason ?? ""))
      );
      expect(
        issuance,
        "expected a 'credit' walletTransaction for Initial wallet issuance"
      ).toBeTruthy();
      expect(issuance!.coins).toBe(wallet!.totalIssuedCoins);
    }
  });
});
