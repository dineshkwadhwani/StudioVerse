/**
 * C-C2 — Company approves an associated coach's coin request.
 *
 * Bootstrap: a pending coinRequest from Shilpa to Narendra; Narendra's
 * wallet topped up so he can cover the transfer. Company UI: Manage Wallet
 * → Coin Requests modal → Approve. Verify status flips to "approved".
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapCoinRequest,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";

const COMPANY = TEST_PHONES.company; // Narendra
const COACH = TEST_PHONES.coachAssociated; // Shilpa
const TENANT_ID = "coaching-studio";
const AMOUNT = 50;

let companyUserId = "";
let coachUserId = "";
let requestId = "";

test.describe("Company · Manage Wallet · Approve Coin Request", () => {
  test.beforeAll(async () => {
    const [c, p] = await Promise.all([getUserByPhone(COMPANY.number), getUserByPhone(COACH.number)]);
    if (!c || !p) throw new Error("Fixture users missing.");
    companyUserId = c.id;
    coachUserId = p.id;

    // Make sure Narendra has enough coins to approve the transfer.
    await ensureWalletAtLeast({
      userId: companyUserId,
      tenantId: TENANT_ID,
      userType: "company",
      userName: COMPANY.fullName,
      minCoins: AMOUNT + 100,
    });
  });

  test.beforeEach(async () => {
    requestId = await bootstrapCoinRequest({
      tenantId: TENANT_ID,
      professionalId: coachUserId,
      professionalName: COACH.fullName,
      companyId: companyUserId,
      amount: AMOUNT,
    });
  });

  test.afterEach(async () => {
    if (requestId) {
      await getAdminDb().collection("coinRequests").doc(requestId).delete().catch(() => {});
    }
  });

  test("Company approves a pending coin request → status becomes approved", async ({
    page,
  }) => {
    await signInAs(page, "company");
    await page.goto("/coaching-studio/manage-wallet", { waitUntil: "domcontentloaded" });

    // Open the Coin Requests modal (button labelled "View Credit Requests").
    await page.getByRole("button", { name: /View Credit Requests/i }).first().click();

    // Wait for the modal's pending row, then click its (only) Approve.
    await expect(page.getByText(COACH.fullName, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Approve$/ }).first().click();

    // Poll DB for status.
    const db = getAdminDb();
    let status = "";
    for (let attempt = 0; attempt < 15; attempt++) {
      const snap = await db.collection("coinRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status === "approved") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected coinRequest status to be 'approved'").toBe("approved");
  });
});
