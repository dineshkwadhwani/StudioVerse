/**
 * Playwright auth helper. Signs the browser into the StudioVerse Coaching
 * Studio via the public phone-OTP flow using one of the canonical
 * pre-provisioned test phone numbers (see tests/fixtures/test-phones.ts).
 *
 * The pre-provisioned phones are configured in Firebase Auth with fixed
 * OTPs, so signInWithPhoneNumber() bypasses the SMS gate and reCAPTCHA
 * verification proceeds without user interaction.
 */

import { type Page, expect } from "@playwright/test";
import { TEST_OTP, TEST_PHONES, type TestPhoneKey } from "../fixtures/test-phones";

const AUTH_URL = "/coaching-studio/auth";

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
  const phone = TEST_PHONES[key].number;
  const role = TEST_PHONES[key].role;

  await page.goto(AUTH_URL, { waitUntil: "domcontentloaded" });

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

  void role; // currently unused; reserved for role-based redirect assertions.

  if (TEST_PHONES[key].preCreated) {
    // Pre-existing users go straight to the dashboard; the AuthWizard pushes
    // /<tenant>/dashboard on verify success.
    await page.waitForURL(/\/coaching-studio\/dashboard/, { timeout: 30_000 });
  } else {
    // Brand-new users land on the role-select phase. Tests that exercise
    // self-registration should advance the wizard themselves.
    await expect(page.locator("text=Who are you?")).toBeVisible({ timeout: 30_000 });
  }
}
