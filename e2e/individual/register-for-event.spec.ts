/**
 * I-B1 — Individual self-registers for an Event from /assign-activity.
 *
 * Bootstrap a published + listing-attached Event so it shows on the
 * Individual's Assign Activities feed. Drive the DetailModal's
 * "Register Now" → AssignmentModal selfAssign path. Verify the resulting
 * assignment doc is status="registered" (selfAssign+event sets that
 * inside AssignmentModal).
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapDraftEvent,
  bootstrapListingPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const EVENT_NAME = "Tier2 Self-Register Event Target";
const LISTING_PACKAGE_NAME = "Tier2 Self-Register Listing Package";
const EVENT_COST = 30; // bootstrapDraftEvent creditsRequired default

let individualUserId = "";
let eventId = "";
let listingPackageId = "";

test.describe("Individual · Assign Activity · Register for Event (self-assign)", () => {
  test.beforeAll(async () => {
    const individual = await getUserByPhone(INDIVIDUAL.number);
    if (!individual) throw new Error("Individual fixture missing.");
    individualUserId = individual.id;

    await deleteDocsWhere("events", "name", EVENT_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "event",
    });
    eventId = await bootstrapDraftEvent({ name: EVENT_NAME, tenantId: TENANT_ID });

    // Promote to published + listed (Assign Activities filter).
    await getAdminDb().collection("events").doc(eventId).update({
      thumbnailUrl: "https://placehold.co/400x300.png",
      status: "published",
      publicationState: "published",
      listingPackageId,
      listingStatus: "approved",
      published: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await ensureWalletAtLeast({
      userId: individualUserId,
      tenantId: TENANT_ID,
      userType: "individual",
      userName: INDIVIDUAL.fullName,
      minCoins: EVENT_COST + 100,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("events", "name", EVENT_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    // Drop any prior self-registration for this event/user.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", eventId)
      .where("assigneeId", "==", individualUserId)
      .get();
    for (const d of snap.docs) await d.ref.delete();
  });

  test("Kiran self-registers for the event → assignment.status='registered'", async ({
    page,
  }) => {
    let registeredAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/event has been assigned/i.test(dialog.message())) {
        registeredAlertSeen = true;
      }
      await dialog.dismiss();
    });

    await signInAs(page, "individualAssociated");
    await page.goto("/coaching-studio/events", { waitUntil: "domcontentloaded" });

    const eventCard = page.locator("article", { hasText: EVENT_NAME }).first();
    await expect(eventCard).toBeVisible({ timeout: 30_000 });
    await eventCard.getByRole("button", { name: /Find out more/i }).click();

    // DetailModal opens. For an event in default mode the primary button is
    // "Register Now". Clicking it → AssignmentModal in selfAssign mode.
    await page.getByRole("button", { name: /^Register Now$/ }).click();

    const modal = page.locator('[class*="backdrop"]').last();
    // In selfAssign mode the modal skips search and lands at confirm — the
    // primary button is "Assign".
    await expect(modal.getByRole("button", { name: /^Assign$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Assign$/ }).click();

    await expect.poll(() => registeredAlertSeen, { timeout: 30_000 }).toBe(true);

    // Verify: exactly one assignment doc for event/Kiran with status=registered.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", eventId)
      .where("assigneeId", "==", individualUserId)
      .get();
    expect(snap.docs, "expected one self-registration").toHaveLength(1);
    const data = snap.docs[0]!.data();
    expect(String(data.activityType ?? "")).toBe("event");
    expect(String(data.status ?? "")).toBe("registered");
    expect(String(data.assignerId ?? "")).toBe(individualUserId);
  });
});
