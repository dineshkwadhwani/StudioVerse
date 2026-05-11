/**
 * C-EVT-001 — Company creates an Event.
 *
 * Flow: Company signs in → `/coaching-studio/manage-events` → click
 * "Add Event" → lands on `/coaching-studio/create-event` → fill form (no
 * promote) → Create. Page auto-redirects back on success.
 *
 * Idempotency: beforeEach deletes any events with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const TEST_NAME = "Company E2E Test Event";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("Company · Manage Events · Create Event", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("events", "name", TEST_NAME);
  });

  test("Company creates a draft Event (coin.png thumbnail)", async ({ page }) => {
    await signInAs(page, "company");

    await page.goto("/coaching-studio/manage-events", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Add Event$/ }).click();
    await page.waitForURL(/\/coaching-studio\/create-event/, { timeout: 15_000 });
    await expect(page.locator("#event-name")).toBeVisible({ timeout: 15_000 });

    await page
      .locator("#event-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();

    await page.fill("#event-name", TEST_NAME);
    await page.fill("#event-short-description", "Short description for Company e2e test event.");
    await page.fill("#event-long-description", "Long description for the Company e2e test event.");
    await page.fill("#event-details", "Detailed agenda placeholder for the test event.");
    await page.selectOption("#event-type", "workshop");
    await page.fill("#event-date", "2026-12-01");
    await page.fill("#event-time", "10:30");
    await page.fill("#event-location-address", "Test Address, Building A");
    await page.fill("#event-location-city", "Pune");
    await page.fill("#event-credits", "30");
    await page.fill("#event-cost", "0");
    await page.setInputFiles("#event-thumbnail", COIN_IMAGE);

    await page.getByRole("button", { name: /^Create$/ }).click();

    await page.waitForURL((url) => !url.pathname.endsWith("/create-event"), {
      timeout: 60_000,
    });

    const snap = await getAdminDb()
      .collection("events")
      .where("name", "==", TEST_NAME)
      .get();
    expect(snap.docs).toHaveLength(1);

    const eventDoc = snap.docs[0]!.data();
    expect(eventDoc.tenantId).toBe(TENANT_ID);
    expect(String(eventDoc.locationCity ?? "")).toBe("Pune");
    expect(Number(eventDoc.creditsRequired ?? 0)).toBe(30);
    expect(String(eventDoc.eventType ?? "")).toBe("workshop");
    expect(String(eventDoc.thumbnailUrl ?? "")).toMatch(/^https?:\/\/.+/);

    await page.goto("/coaching-studio/manage-events", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(TEST_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
