/**
 * P-COIN-001 — Coach (Shilpa) requests coins from her associated Company.
 *
 * Flow: Coach signs in → /coaching-studio/request-coins → fill amount +
 * message → Submit. Verify `coinRequests` doc.
 *
 * Idempotency: beforeEach/afterEach delete any pending coinRequest from
 * Shilpa to Narendra so the test can be re-run safely.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import { getAdminDb, getUserByPhone } from "../../tests/helpers/admin-firestore";

const COACH = TEST_PHONES.coachAssociated; // Shilpa
const COMPANY = TEST_PHONES.company; // Narendra
const REQUEST_AMOUNT = 100;
const TEST_MESSAGE = "E2E test request — please ignore.";

let coachUserId = "";
let companyUserId = "";

async function deleteRequest(): Promise<void> {
  if (!coachUserId) return;
  const db = getAdminDb();
  const snap = await db
    .collection("coinRequests")
    .where("requesterProfessionalId", "==", coachUserId)
    .where("status", "==", "pending")
    .get();
  for (const d of snap.docs) await d.ref.delete();
}

test.describe("Coach · Manage Wallet · Request Coins", () => {
  test.beforeAll(async () => {
    const [coach, company] = await Promise.all([
      getUserByPhone(COACH.number),
      getUserByPhone(COMPANY.number),
    ]);
    if (!coach || !company) throw new Error("Required fixture users missing.");
    coachUserId = coach.id;
    companyUserId = company.id;
  });

  test.beforeEach(deleteRequest);
  test.afterEach(deleteRequest);

  test("Coach submits a coin request to her company", async ({ page }) => {
    await signInAs(page, "coachAssociated");

    await page.goto("/coaching-studio/request-coins", { waitUntil: "domcontentloaded" });

    // "Number of Coins *" is the required field; label search.
    const amountInput = page.locator(
      'xpath=//label[normalize-space()="Number of Coins *"]/following-sibling::input[1]'
    );
    await expect(amountInput).toBeVisible({ timeout: 30_000 });
    await amountInput.fill(String(REQUEST_AMOUNT));

    const messageBox = page.locator(
      'xpath=//label[normalize-space()="Message (optional)"]/following-sibling::textarea[1]'
    );
    await messageBox.fill(TEST_MESSAGE);

    await page.getByRole("button", { name: /^Submit Request$/ }).click();

    // The page typically redirects back to manage-wallet (or shows confirmation).
    // Wait for the amount input to clear or page to navigate.
    await Promise.race([
      page.waitForURL((url) => !url.pathname.endsWith("/request-coins"), { timeout: 30_000 }),
      expect(amountInput).toHaveValue("", { timeout: 30_000 }),
    ]);

    // Verify via Admin SDK.
    const snap = await getAdminDb()
      .collection("coinRequests")
      .where("requesterProfessionalId", "==", coachUserId)
      .where("status", "==", "pending")
      .get();
    expect(snap.docs, "expected one pending coin request").toHaveLength(1);
    const req = snap.docs[0]!.data();
    expect(Number(req.amount ?? 0)).toBe(REQUEST_AMOUNT);
    expect(String(req.companyId ?? "")).toBe(companyUserId);
  });
});
