/**
 * SA-USR-001 — SuperAdmin creates a Company user (idempotent).
 *
 * Per user direction (2026-05-11): Narendra is the canonical Company fixture
 * that other tests rely on. This test must NEVER delete him. Behaviour:
 *
 *   • If Narendra already exists in `users/`, skip the create-via-UI step
 *     and assert the existing record looks like a Company.
 *   • If Narendra does not exist, drive the SA portal Create User flow,
 *     verify the resulting `invitations/` doc, and leave the invitation
 *     in place (claimed at first sign-in).
 *
 * Either way, no state is destroyed.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  findUsersByPhone,
  getAdminDb,
  toE164India,
} from "../../tests/helpers/admin-firestore";

const COMPANY = TEST_PHONES.company; // 9168676738
const TENANT_ID = "coaching-studio";
const COMPANY_NAME = "Narendra Co";
const COMPANY_OWNER_NAME = "Narendra Chouhan";
const COMPANY_OWNER_EMAIL = "narendra@example.com";

test.describe("SuperAdmin · Users · Create Company (idempotent)", () => {
  test("Narendra (Company) exists, else SA creates an invitation for him", async ({
    page,
  }) => {
    const existing = await findUsersByPhone(COMPANY.number);
    if (existing.length > 0) {
      // Fast-path: he's already there. Just confirm the shape.
      const data = existing[0]!.data;
      expect(String(data.userType ?? "")).toBe("company");
      expect(String(data.tenantId ?? "")).toBe(TENANT_ID);
      expect(String(data.phoneE164 ?? "")).toBe(toE164India(COMPANY.number));
      test.info().annotations.push({
        type: "behaviour",
        description: `Narendra already exists (uid=${existing[0]!.id}); creation step skipped.`,
      });
      return;
    }

    // Slow-path: drive the SA portal Create User form. Leaves a pending
    // invitation behind; first sign-in by the phone will claim it.
    await signInAs(page, "superAdmin");
    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Users$/ }).first().click();

    await expect(page.locator("#create-user-type")).toBeVisible({ timeout: 15_000 });
    await page.selectOption("#create-user-type", "company");

    const tenantSelect = page.locator("#user-tenant-id-input");
    await expect(tenantSelect.locator(`option[value="${TENANT_ID}"]`)).toHaveCount(1, {
      timeout: 15_000,
    });
    await tenantSelect.selectOption(TENANT_ID);

    await page.fill("#user-company-name-input", COMPANY_NAME);
    await page.fill("#user-name-input", COMPANY_OWNER_NAME);
    await page.fill("#user-phone-input", `+91${COMPANY.number}`);
    await page.fill("#user-email-input", COMPANY_OWNER_EMAIL);

    await page.getByRole("button", { name: /^Create User$/ }).click();
    await expect(page.getByText(/User saved/i).first()).toBeVisible({ timeout: 20_000 });

    // Verify the invitation landed in `invitations/`.
    const inviteSnap = await getAdminDb()
      .collection("invitations")
      .where("phoneE164", "==", toE164India(COMPANY.number))
      .get();
    expect(inviteSnap.docs, "expected one pending invitation for the test phone").toHaveLength(1);

    const invite = inviteSnap.docs[0]!.data();
    expect(String(invite.userType ?? "")).toBe("company");
    expect(String(invite.tenantId ?? "")).toBe(TENANT_ID);

    test.info().annotations.push({
      type: "behaviour",
      description: `Narendra was missing; SA Create flow used. Invitation left in place.`,
    });
  });
});
