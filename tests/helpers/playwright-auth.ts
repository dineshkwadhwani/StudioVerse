/**
 * Playwright auth helpers. Signs the browser into StudioVerse using one of
 * the canonical pre-provisioned Firebase Auth test phone numbers (see
 * `tests/fixtures/test-phones.ts`).
 *
 * Routing rules:
 *  - SuperAdmin lives on `tenantId="platform"`, which the public Coaching
 *    auth page can't match. SuperAdmin therefore signs in via the SA portal's
 *    own login at `/admin` (different markup, different lookup).
 *  - All other roles (company / professional / individual) sign in via the
 *    public phone-OTP wizard at `/coaching-studio/auth`.
 *
 * `signInAs(page, key)` dispatches to the right flow based on the fixture's
 * role.
 */

import { type Page, expect } from "@playwright/test";
import { TEST_OTP, TEST_PHONES, type TestPhoneKey } from "../fixtures/test-phones";

const COACHING_AUTH_URL = "/coaching-studio/auth";
const ADMIN_URL = "/admin";

/**
 * Click "Send OTP" and advance to the OTP phase. Handles the brief race where
 * the AuthWizard's RecaptchaVerifier ref hasn't populated yet on the very
 * first render — the wizard surfaces "reCAPTCHA not ready" in that case, so
 * we wait briefly and retry once.
 */
async function sendOtpWithRetry(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.click("button:has-text('Send OTP')");
    try {
      await page.waitForSelector("#wiz-otp", { state: "visible", timeout: 8_000 });
      return;
    } catch {
      // If the wizard surfaced the not-ready hint, dismiss any state and retry.
      const hint = page.locator("text=reCAPTCHA not ready");
      if (await hint.count()) {
        await page.waitForTimeout(1_000);
        continue;
      }
      // Some other failure — give one more cycle for slow Next.js dev compile.
      await page.waitForTimeout(2_000);
    }
  }
  // Final attempt; let waitForSelector below produce the diagnostic.
  await page.click("button:has-text('Send OTP')");
}

export async function signInAs(page: Page, key: TestPhoneKey): Promise<void> {
  const phoneFixture = TEST_PHONES[key];

  if (phoneFixture.role === "superadmin") {
    await signInAsSuperAdmin(page, phoneFixture.number);
    return;
  }

  await signInViaCoachingAuthWizard(page, phoneFixture, key);
}

/**
 * SuperAdmin sign-in via the dedicated `/admin` portal login. The SA login
 * has its own markup (`#mobile-number`, `#otp`, `#superadmin-recaptcha`) and
 * does a tenant-agnostic SA lookup, which is the only way to authenticate a
 * user whose tenantId is "platform" rather than a studio slug.
 */
async function signInAsSuperAdmin(page: Page, phone: string): Promise<void> {
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#mobile-number", { state: "visible", timeout: 20_000 });
  await page.fill("#mobile-number", phone);

  // Send OTP — handle reCAPTCHA-not-ready race the same way as the wizard.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: /^Send OTP$/ }).click();
    try {
      // The OTP input always exists on this screen, but the "Verify OTP"
      // button enables only after a confirmation result is set. Wait for it.
      await expect(page.getByRole("button", { name: /^Verify OTP$/ })).toBeEnabled({
        timeout: 8_000,
      });
      break;
    } catch {
      await page.waitForTimeout(1_500);
    }
  }

  await page.fill("#otp", TEST_OTP);
  await page.getByRole("button", { name: /^Verify OTP$/ }).click();

  // Successful SA sign-in renders the portal toolbar with the "ADMIN" badge.
  await expect(page.getByText(/^ADMIN$/).first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Non-SA sign-in via the public Coaching Studio auth wizard.
 */
async function signInViaCoachingAuthWizard(
  page: Page,
  phoneFixture: (typeof TEST_PHONES)[TestPhoneKey],
  _key: TestPhoneKey
): Promise<void> {
  const phone = phoneFixture.number;

  await page.goto(COACHING_AUTH_URL, { waitUntil: "domcontentloaded" });

  // The phone input renders before RecaptchaVerifier is constructed in the
  // AuthWizard useEffect. Wait for the input first.
  await page.waitForSelector("#wiz-phone", { state: "visible", timeout: 20_000 });

  // Phase 1 — phone. Submit then handle the rare "reCAPTCHA not ready" race
  // where useEffect hasn't populated the verifier ref yet.
  await page.fill("#wiz-phone", phone);
  await sendOtpWithRetry(page);

  // Phase 2 — OTP. Wait for the OTP input to render before typing.
  await page.waitForSelector("#wiz-otp", { state: "visible", timeout: 30_000 });
  await page.fill("#wiz-otp", TEST_OTP);
  await page.click("button:has-text('Verify OTP')");

  if (phoneFixture.preCreated) {
    // Pre-existing users go straight to the dashboard.
    await page.waitForURL(/\/coaching-studio\/dashboard/, { timeout: 30_000 });
  } else {
    // Brand-new users land on the role-select phase.
    await expect(page.locator("text=Who are you?")).toBeVisible({ timeout: 30_000 });
  }
}
