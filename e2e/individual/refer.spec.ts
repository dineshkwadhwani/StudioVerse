/**
 * I-REF-001 — Individual (Kiran) refers someone via Manage Referrals.
 *
 * Scope: this test exercises the **referral creation** path. The full "when
 * they join, coins go to joiner + referrer" leg is server-side, fires only
 * after the referred phone actually signs in, and is verified separately in
 * dedicated registration tests. Here we assert:
 *
 *   • A `referrals/` doc is created with the referrer = Kiran, the test
 *     phone/email, and status = "referred".
 *
 * Idempotency: beforeEach deletes any prior referral with the test phone or
 * email so re-runs don't trip over the dup-detection logic.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import { getAdminDb, getUserByPhone } from "../../tests/helpers/admin-firestore";

const REFERRER = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
// Synthetic referee — never used as a real account, just a target for the
// referral record. E.164 format expected by the page placeholder.
const REFEREE_PHONE = "+919999900099";
const REFEREE_EMAIL = "referral.test+kiran@example.com";

let referrerUserId = "";

async function deleteTestReferral(): Promise<void> {
  const db = getAdminDb();
  const byPhone = await db
    .collection("referrals")
    .where("tenantId", "==", TENANT_ID)
    .where("referredPhone", "==", REFEREE_PHONE)
    .get();
  for (const d of byPhone.docs) await d.ref.delete();
  const byEmail = await db
    .collection("referrals")
    .where("tenantId", "==", TENANT_ID)
    .where("referredEmail", "==", REFEREE_EMAIL)
    .get();
  for (const d of byEmail.docs) await d.ref.delete();
}

test.describe("Individual · Manage Referrals · Create Referral", () => {
  test.beforeAll(async () => {
    const referrer = await getUserByPhone(REFERRER.number);
    if (!referrer) throw new Error("Kiran (referrer) missing from fixtures.");
    referrerUserId = referrer.id;
  });

  test.beforeEach(deleteTestReferral);
  test.afterEach(deleteTestReferral);

  test("Individual creates a referral (status: referred, referrer = Kiran)", async ({
    page,
  }) => {
    await signInAs(page, "individualAssociated");

    await page.goto("/coaching-studio/manage-referrals", { waitUntil: "domcontentloaded" });

    // Default "Referred Type" is "individual". Leave it.
    await expect(page.locator("#referred-email")).toBeVisible({ timeout: 30_000 });
    await page.fill("#referred-email", REFEREE_EMAIL);
    await page.fill("#referred-phone", REFEREE_PHONE);

    await page.getByRole("button", { name: /^Create New Referral$/ }).click();

    // Wait for the success message OR the form to clear.
    await expect(page.locator("#referred-email")).toHaveValue("", { timeout: 30_000 });

    // Verify in Firestore.
    const snap = await getAdminDb()
      .collection("referrals")
      .where("tenantId", "==", TENANT_ID)
      .where("referredPhone", "==", REFEREE_PHONE)
      .get();
    expect(snap.docs, "expected exactly one referral with the test phone").toHaveLength(1);

    const referral = snap.docs[0]!.data();
    expect(String(referral.referrerUserId ?? "")).toBe(referrerUserId);
    expect(String(referral.referredEmail ?? "")).toBe(REFEREE_EMAIL);
    expect(String(referral.referredPhone ?? "")).toBe(REFEREE_PHONE);
    expect(String(referral.status ?? "")).toBe("referred");
  });
});
