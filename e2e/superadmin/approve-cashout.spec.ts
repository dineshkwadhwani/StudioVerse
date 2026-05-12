/**
 * SA-B3 — SuperAdmin approves a cashout request.
 *
 * Bootstrap a pending cashout, sign in as SA, navigate Approve Requests →
 * Cash Out tab, click Approve. Verify status flips to "approved".
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapCashoutRequest,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachIndependent; // Independent coach (Dinesh)
const TENANT_ID = "coaching-studio";

let coachUserId = "";
let requestId = "";

test.describe("SuperAdmin · Approve Requests · Cash Out", () => {
  test.beforeAll(async () => {
    const c = await getUserByPhone(COACH.number);
    if (!c) throw new Error("Coach fixture missing.");
    coachUserId = c.id;
  });

  test.beforeEach(async () => {
    requestId = await bootstrapCashoutRequest({
      tenantId: TENANT_ID,
      requesterUserId: coachUserId,
      requesterName: COACH.fullName,
      amount: 100,
    });
  });

  test.afterEach(async () => {
    if (requestId) {
      await getAdminDb().collection("cashoutRequests").doc(requestId).delete().catch(() => {});
    }
  });

  test("SA approves a pending cashout → status becomes approved", async ({ page }) => {
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Approve Requests$/ }).first().click();

    // The tab button's accessible name is "Cash Out <count>", so match
    // anywhere in the string.
    await page.getByRole("button", { name: /Cash Out/ }).first().click();

    // The pending row contains the requester name; locate that row's Approve.
    const row = page.getByText(COACH.fullName, { exact: true }).first()
      .locator("xpath=ancestor::*[self::article or self::tr or self::section][1]");
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("button", { name: /^Approve$/ }).click();

    // Poll DB for status.
    const db = getAdminDb();
    let status = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const snap = await db.collection("cashoutRequests").doc(requestId).get();
      status = String(snap.data()?.status ?? "");
      if (status === "approved") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected cashout status to be 'approved'").toBe("approved");
  });
});
