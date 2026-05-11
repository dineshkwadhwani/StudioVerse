/**
 * SA-EVT-EDIT-001 — SuperAdmin edits an existing Event (draft mode).
 *
 * Scope note: scaled back from "attach a Promotion Package" per user
 * direction 2026-05-11. The Promotion Package selector only renders when
 * "Promote now" is ticked, which we're keeping unchecked. This test
 * exercises the edit-and-save path against an existing Event.
 *
 * The Event is created in-test via the same UI flow as create-event.spec
 * (rather than bootstrapped via Admin SDK) so it goes through the production
 * normalisation pipeline and passes the Cloud Function's schema validation
 * on the subsequent edit.
 *
 * Verifies both:
 *   • Firestore — `shortDescription` is the marker value.
 *   • Manage Events page — the event is listed and the new shortDescription
 *     is visible on its tile.
 *
 * Idempotency: beforeEach deletes any events with the test name.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { deleteDocsWhere, getAdminDb } from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const EVENT_NAME = "E2E Edit Event (draft)";
const MARKER = `E2E EDIT MARKER ${Date.now()}`;
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

test.describe("SuperAdmin · Resources · Edit Event (draft)", () => {
  test.beforeEach(async () => {
    await deleteDocsWhere("events", "name", EVENT_NAME);
  });

  test("SA creates an Event via UI, then edits shortDescription and saves as draft", async ({
    page,
  }) => {
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Resources$/ }).first().click();
    await page.locator("#resources-tab-events").click();
    await expect(page.getByRole("button", { name: /^Add Event$/ })).toBeVisible({
      timeout: 15_000,
    });

    // ── 1. Create the Event via the UI (no promote). ───────────────────────
    await page.getByRole("button", { name: /^Add Event$/ }).click();
    await expect(page.locator("#event-name")).toBeVisible({ timeout: 15_000 });

    await page
      .locator("#event-tenant")
      .getByRole("checkbox", { name: /Coaching Studio/i })
      .check();
    await page.fill("#event-name", EVENT_NAME);
    await page.fill("#event-short-description", "Initial short description.");
    await page.fill("#event-long-description", "Initial long description.");
    await page.fill("#event-details", "Initial details.");
    await page.selectOption("#event-type", "workshop");
    await page.fill("#event-date", "2026-12-01");
    await page.fill("#event-time", "10:30");
    await page.fill("#event-location-address", "Test Address, Building A");
    await page.fill("#event-location-city", "Pune");
    await page.fill("#event-credits", "30");
    await page.fill("#event-cost", "0");
    await page.setInputFiles("#event-thumbnail", COIN_IMAGE);

    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(page.locator("#event-name")).toBeHidden({ timeout: 60_000 });

    // Verify the new event is visible on the Manage Events page list.
    await expect(page.getByText(EVENT_NAME, { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // ── 2. Open it in Edit and change shortDescription. ────────────────────
    const title = page.getByText(EVENT_NAME, { exact: true });
    const row = title.locator("xpath=ancestor::article[1]");
    await row.getByRole("button", { name: /^Edit$/ }).click();

    await expect(page.locator("#event-name")).toBeVisible({ timeout: 15_000 });
    await page.fill("#event-short-description", MARKER);

    // Save in draft mode (leave Promote unchecked).
    await page.getByRole("button", { name: /^Update$/ }).click();
    await expect(page.locator("#event-name")).toBeHidden({ timeout: 60_000 });

    // ── 3. Verify both UI and Firestore reflect the change. ────────────────
    await expect(page.getByText(MARKER)).toBeVisible({ timeout: 15_000 });

    const snap = await getAdminDb()
      .collection("events")
      .where("name", "==", EVENT_NAME)
      .get();
    expect(snap.docs).toHaveLength(1);
    expect(String(snap.docs[0]!.data().shortDescription ?? "")).toBe(MARKER);
    expect(snap.docs[0]!.data().tenantId).toBe(TENANT_ID);
  });
});
