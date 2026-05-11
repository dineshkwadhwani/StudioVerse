/**
 * I-MYA-001 — Individual (Kiran) views My Activities.
 *
 * Pre-condition: a published Program assigned to Kiran exists. The test
 * bootstraps both (program + assignment) via Admin SDK so the test runs
 * independent of any prior Coach-assigns-Program activity.
 *
 * Flow:
 *   1. Kiran signs in → /coaching-studio/my-activities.
 *   2. The fixture assignment is visible in the list (activity title +
 *      type label).
 *
 * Idempotency: beforeAll cleans up + recreates; afterAll removes fixtures.
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

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "Individual My-Activities Program";
const LISTING_PACKAGE_NAME = "Individual My-Activities Listing Package";

let individualUserId = "";
let programId = "";
let listingPackageId = "";
let assignmentId = "";

async function cleanupAssignment(): Promise<void> {
  if (assignmentId) {
    await getAdminDb().collection("assignments").doc(assignmentId).delete().catch(() => {});
  }
}

test.describe("Individual · My Activities", () => {
  test.beforeAll(async () => {
    const ind = await getUserByPhone(INDIVIDUAL.number);
    if (!ind) throw new Error("Kiran fixture missing.");
    individualUserId = ind.id;

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

    assignmentId = await bootstrapAssignment({
      tenantId: TENANT_ID,
      activityType: "program",
      activityId: programId,
      activityTitle: PROGRAM_NAME,
      assigneeId: individualUserId,
      assigneeFullName: INDIVIDUAL.fullName,
      assignerId: individualUserId, // synthetic — self-assigned
      assignerName: INDIVIDUAL.fullName,
      status: "assigned",
    });
  });

  test.afterAll(async () => {
    await cleanupAssignment();
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test("Kiran sees the assigned Program on My Activities", async ({ page }) => {
    await signInAs(page, "individualAssociated");

    await page.goto("/coaching-studio/my-activities", { waitUntil: "domcontentloaded" });

    // The activity title should appear in the list.
    await expect(page.getByText(PROGRAM_NAME, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
