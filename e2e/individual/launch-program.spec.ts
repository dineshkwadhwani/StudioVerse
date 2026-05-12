/**
 * I-B3 — Individual launches an assigned Program from My Activities.
 *
 * Bootstrap a published+listing program with a videoUrl and an assignment
 * for Kiran with status="assigned". Kiran clicks "Launch the program" on
 * My Activities. The handler:
 *   • updates assignment status → "in_progress"
 *   • opens the program video in a new tab/popup
 *
 * Verifies the assignment's status flips to "in_progress" in Firestore.
 * The popup itself is intercepted (Playwright opens it as a new context
 * page) and immediately closed, so it doesn't drift the test.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapAssignment,
  bootstrapDraftProgram,
  bootstrapListingPackage,
  deleteDocsWhere,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const ASSIGNER = TEST_PHONES.coachAssociated; // Shilpa as the assigner
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Tier2 Launch-Program Target";
const LISTING_PACKAGE_NAME = "Tier2 Launch-Program Listing";

let individualUserId = "";
let assignerUserId = "";
let programId = "";
let listingPackageId = "";
let assignmentId = "";

test.describe("Individual · My Activities · Launch assigned Program", () => {
  test.beforeAll(async () => {
    const [individual, assigner] = await Promise.all([
      getUserByPhone(INDIVIDUAL.number),
      getUserByPhone(ASSIGNER.number),
    ]);
    if (!individual || !assigner) throw new Error("Required fixture users missing.");
    individualUserId = individual.id;
    assignerUserId = assigner.id;

    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
    programId = await bootstrapDraftProgram({
      name: PROGRAM_NAME,
      tenantId: TENANT_ID,
      publish: true,
      listingPackageId,
    });

    // Add a videoUrl so handleLaunchProgram opens its popup. The exact URL
    // doesn't matter — Playwright will intercept and close the popup.
    await getAdminDb().collection("programs").doc(programId).update({
      videoUrl: "https://example.com/e2e-test-video",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    // Clean and re-create a fresh "assigned" assignment for this run.
    const db = getAdminDb();
    const stale = await db
      .collection("assignments")
      .where("activityId", "==", programId)
      .where("assigneeId", "==", individualUserId)
      .get();
    for (const d of stale.docs) await d.ref.delete();

    assignmentId = await bootstrapAssignment({
      tenantId: TENANT_ID,
      activityType: "program",
      activityId: programId,
      activityTitle: PROGRAM_NAME,
      assigneeId: individualUserId,
      assigneeFullName: INDIVIDUAL.fullName,
      assignerId: assignerUserId,
      assignerName: ASSIGNER.fullName,
      status: "assigned",
    });
  });

  test("Kiran clicks 'Launch the program' → assignment.status='in_progress'", async ({
    page,
  }) => {
    // Close any popups the launch handler tries to open so they don't
    // affect the test page.
    page.context().on("page", (popup) => {
      void popup.close().catch(() => undefined);
    });

    await signInAs(page, "individualAssociated");
    await page.goto("/coaching-studio/my-activities", { waitUntil: "domcontentloaded" });

    // Scope to the row for our specific program.
    const ourRow = page
      .getByText(PROGRAM_NAME, { exact: true })
      .first()
      .locator("xpath=ancestor::article[1]");
    await expect(ourRow).toBeVisible({ timeout: 30_000 });

    await ourRow.getByRole("button", { name: /^Launch the program$/ }).click();

    // Poll the DB for the status transition.
    const db = getAdminDb();
    let status = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const snap = await db.collection("assignments").doc(assignmentId).get();
      status = String(snap.data()?.status ?? "");
      if (status === "in_progress") break;
      await page.waitForTimeout(1_000);
    }
    expect(status, "expected status to flip to 'in_progress'").toBe("in_progress");
  });
});
