/**
 * I-B4 — Individual takes an assessment via "Try Now" (self-assign).
 *
 * Bootstrap a published+listing-attached assessment so it surfaces on
 * /tools. Drive: Find out more... → DetailModal "Try Now" →
 * AssignmentModal (selfAssign=true) → Assign. Verify a new assignment
 * doc exists with activityType="assessment", assigneeId=Kiran,
 * status="assigned".
 *
 * I-B4 only covers the *assignment creation* path; the full take-and-
 * report flow is covered by I-B2.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  bootstrapListingPackage,
  deleteDocsWhere,
  ensureWalletAtLeast,
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const TENANT_ID = "coaching-studio";
const ASSESSMENT_NAME = "Tier2 Try-Now Assessment Target";
const LISTING_PACKAGE_NAME = "Tier2 Try-Now Listing Package";

let individualUserId = "";
let assessmentId = "";
let listingPackageId = "";

test.describe("Individual · Tools · Try Now self-assign assessment", () => {
  test.beforeAll(async () => {
    const individual = await getUserByPhone(INDIVIDUAL.number);
    if (!individual) throw new Error("Individual fixture missing.");
    individualUserId = individual.id;

    await deleteDocsWhere("assessments", "name", ASSESSMENT_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);

    listingPackageId = await bootstrapListingPackage({
      name: LISTING_PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "assessment",
    });

    const ref = getAdminDb().collection("assessments").doc();
    await ref.set({
      tenantId: TENANT_ID,
      tenantIds: [TENANT_ID],
      name: ASSESSMENT_NAME,
      shortDescription: "Tier2 e2e short description.",
      longDescription: "Tier2 e2e long description.",
      assessmentImageUrl: "https://placehold.co/400x300.png",
      assessmentImagePath: "",
      assessmentContext: "Try-Now path.",
      assessmentBenefit: "Validate self-assign.",
      assessmentType: "self-assessment",
      renderStyle: "single-choice",
      reportStyle: "development-template",
      creditsRequired: 0,
      questionBankCount: 0,
      questionsPerAttempt: 1,
      analysisPrompt: "",
      questionGenerationPrompt: "",
      status: "published",
      promoted: false,
      promotionPackageId: null,
      promotionStatus: "none",
      listingPackageId,
      listingStatus: "approved",
      publicationState: "published",
      visibility: "public",
      ownershipScope: "platform",
      ownerEntityId: "platform",
      createdBy: "e2e",
      updatedBy: "e2e",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    assessmentId = ref.id;

    await ensureWalletAtLeast({
      userId: individualUserId,
      tenantId: TENANT_ID,
      userType: "individual",
      userName: INDIVIDUAL.fullName,
      minCoins: 100,
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("assessments", "name", ASSESSMENT_NAME);
    await deleteDocsWhere("listingPackages", "name", LISTING_PACKAGE_NAME);
  });

  test.beforeEach(async () => {
    // Clear any prior self-assignment from earlier runs.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", assessmentId)
      .where("assigneeId", "==", individualUserId)
      .get();
    for (const d of snap.docs) await d.ref.delete();
  });

  test("Kiran clicks Try Now → an assessment self-assignment is created", async ({ page }) => {
    let assignedAlertSeen = false;
    page.on("dialog", async (dialog) => {
      if (/assessment has been assigned/i.test(dialog.message())) {
        assignedAlertSeen = true;
      }
      await dialog.dismiss();
    });

    await signInAs(page, "individualAssociated");
    await page.goto("/coaching-studio/tools", { waitUntil: "domcontentloaded" });

    const card = page.locator("article", { hasText: ASSESSMENT_NAME }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole("button", { name: /Find out more/i }).click();

    // DetailModal opens. "Try Now" is the primary button for tool items.
    await page.getByRole("button", { name: /^Try Now$/ }).click();

    // AssignmentModal (selfAssign) lands on confirm; click Assign.
    const modal = page.locator('[class*="backdrop"]').last();
    await expect(modal.getByRole("button", { name: /^Assign$/ })).toBeVisible({
      timeout: 15_000,
    });
    await modal.getByRole("button", { name: /^Assign$/ }).click();

    await expect.poll(() => assignedAlertSeen, { timeout: 30_000 }).toBe(true);

    // Verify a new self-assignment doc exists.
    const snap = await getAdminDb()
      .collection("assignments")
      .where("activityId", "==", assessmentId)
      .where("assigneeId", "==", individualUserId)
      .get();
    expect(snap.docs, "expected one self-assignment for the assessment").toHaveLength(1);
    const data = snap.docs[0]!.data();
    expect(String(data.activityType ?? "")).toBe("assessment");
    expect(String(data.assignerId ?? "")).toBe(individualUserId);
    expect(String(data.status ?? "")).toBe("assigned");
  });
});
