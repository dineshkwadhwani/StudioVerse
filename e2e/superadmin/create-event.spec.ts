/**
 * SA-EVT-001 — SuperAdmin creates a new Event.
 *
 * Flow: SA → /admin → Resources → Events tab → Add Event → fill required
 * fields (Coaching tenant, name, credits) + optional event date/time/city +
 * coin.png thumbnail → Create. Verify via Admin SDK.
 *
 * Idempotency: beforeEach deletes any events with the test name.
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "E2E Test Event";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

async function openResourcesEvents(page: Page): Promise<void> {
  await page.locator('button[class*="profileButton"]').first().click();
  await page.getByRole("button", { name: /^Resources$/ }).first().click();
  await page.locator("#resources-tab-events").click();
  await expect(page.getByRole("button", { name: /^Add Event$/ })).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("SuperAdmin · Manage Resources · Create Event", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("events", "name", TEST_NAME);
  });

  test("SA creates a draft Event in Coaching Studio with coin.png thumbnail", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");
    await openResourcesEvents(page);

    await page.getByRole("button", { name: /^Add Event$/ }).click();
    await expect(page.locator("#event-name")).toBeVisible({ timeout: 15_000 });

    // Tenant checkbox.
    await page
      .locator("#event-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();

    await page.fill("#event-name", TEST_NAME);
    await page.fill("#event-short-description", "Short description for e2e test event.");
    await page.fill("#event-long-description", "Long description for the e2e test event.");
    await page.fill("#event-details", "Detailed agenda placeholder for the e2e test event.");
    await page.selectOption("#event-type", "workshop");
    await page.fill("#event-date", "2026-12-01");
    await page.fill("#event-time", "10:30");
    await page.fill("#event-location-address", "Test Address, Building A");
    await page.fill("#event-location-city", "Pune");
    await page.fill("#event-credits", "30");
    await page.fill("#event-cost", "0");
    await page.setInputFiles("#event-thumbnail", COIN_IMAGE);

    await page.getByRole("button", { name: /^Create$/ }).click();

    // Form closes on save success. #event-name should detach.
    await expect(page.locator("#event-name")).toBeHidden({ timeout: 60_000 });

    // Verify in DB.
    const db = getAdminDb();
    const snap = await db.collection("events").where("name", "==", TEST_NAME).get();
    expect(snap.docs).toHaveLength(1);

    const eventDoc = snap.docs[0]!.data();
    expect(eventDoc.tenantId).toBe(TENANT_ID);
    const tenantIds: string[] = Array.isArray(eventDoc.tenantIds) ? eventDoc.tenantIds : [];
    expect(tenantIds).toContain(TENANT_ID);
    expect(String(eventDoc.locationCity ?? "")).toBe("Pune");
    expect(Number(eventDoc.creditsRequired ?? 0)).toBe(30);
    expect(String(eventDoc.eventType ?? "")).toBe("workshop");
    expect(String(eventDoc.thumbnailUrl ?? "")).toMatch(/^https?:\/\/.+/);
  });
});
