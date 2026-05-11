/**
 * SA-PRG-EDIT-001 — SuperAdmin edits a Program to use a Listing Package.
 *
 * The Listing Package selector in the Program form only appears when the
 * "Publish now" checkbox is ticked. This test:
 *   1. Bootstraps a draft Program + an active Listing Package via Admin SDK.
 *   2. Drives the SA portal Edit modal: check Publish, pick the package, Save.
 *   3. Asserts the Program doc now has listingPackageId set to the package id.
 *
 * Idempotency: beforeAll cleans up any existing fixtures with these names and
 * creates fresh ones. afterAll removes them.
 */

import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "../../tests/helpers/playwright-auth";
import {
  bootstrapDraftProgram,
  bootstrapListingPackage,
  deleteDocsWhere,
  getAdminDb,
} from "../../tests/helpers/admin-firestore";

const TENANT_ID = "coaching-studio";
const PROGRAM_NAME = "E2E Edit Program (attach listing)";
const PACKAGE_NAME = "E2E Listing Package (attach test)";
const COIN_IMAGE = path.resolve(
  __dirname,
  "../../public/tenants/coaching-studio/coin.png"
);

let programId = "";
let packageId = "";

// Disabled pending a small refactor: the package-attach path only opens when
// "Publish now" is checked, which triggers server-side Cloud Function
// validation (programWriteSchema + business rules). An Admin-SDK-bootstrapped
// program doc currently fails that validation with "Program validation
// failed" (catalogVisibility/publicationState/etc. mismatch).
//
// Fix path: either (a) drive the create via the UI flow in beforeAll so the
// fixture goes through the same normaliseProgramForm path as production, or
// (b) mirror programWriteSchema in bootstrapDraftProgram. Track in
// docs/AUTOMATION_PROGRESS.md.
test.describe.skip("SuperAdmin · Resources · Edit Program → attach Listing Package", () => {
  test.beforeAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", PACKAGE_NAME);
    programId = await bootstrapDraftProgram({ name: PROGRAM_NAME, tenantId: TENANT_ID });
    packageId = await bootstrapListingPackage({
      name: PACKAGE_NAME,
      tenantId: TENANT_ID,
      resourceType: "program",
    });
  });

  test.afterAll(async () => {
    await deleteDocsWhere("programs", "name", PROGRAM_NAME);
    await deleteDocsWhere("listingPackages", "name", PACKAGE_NAME);
  });

  test("SA opens program → publishes with listing package → save persists listingPackageId", async ({
    page,
  }) => {
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log("[browser-error]", msg.text());
    });
    page.on("pageerror", (err) => console.log("[browser-pageerror]", err.message));
    await signInAs(page, "superAdmin");

    await page.locator('button[class*="profileButton"]').first().click();
    await page.getByRole("button", { name: /^Resources$/ }).first().click();
    await page.locator("#resources-tab-programs").click();

    // Locate the program row by exact title text, then climb to its article
    // and click Edit.
    const title = page.getByText(PROGRAM_NAME, { exact: true });
    await expect(title).toBeVisible({ timeout: 30_000 });
    const row = title.locator("xpath=ancestor::article[1]");
    await row.getByRole("button", { name: /^Edit$/ }).click();

    // Wait for the program edit form.
    await expect(page.locator("#program-name")).toBeVisible({ timeout: 15_000 });

    // To publish we need to satisfy validation: thumbnail. Upload coin.png.
    await page.setInputFiles("#program-thumbnail", COIN_IMAGE);

    // Check "Publish now". The Listing Package select then renders.
    await page.getByRole("checkbox", { name: /^Publish now$/ }).check();

    const listingSelect = page.locator("#program-listing-package");
    await expect(listingSelect).toBeVisible({ timeout: 10_000 });
    await expect(listingSelect).toBeEnabled();
    await listingSelect.selectOption(packageId);

    // Save (Update button — already-editing mode).
    await page.getByRole("button", { name: /^Update$/ }).click();

    // Form closes on save success.
    await expect(page.locator("#program-name")).toBeHidden({ timeout: 60_000 });

    // Verify listingPackageId persisted.
    const snap = await getAdminDb().collection("programs").doc(programId).get();
    expect(snap.exists).toBe(true);
    const data = snap.data()!;
    expect(String(data.listingPackageId ?? "")).toBe(packageId);
  });
});
