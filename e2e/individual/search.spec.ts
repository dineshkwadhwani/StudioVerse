/**
 * I-SRCH-001 — Individual (Kiran) searches across catalogue + people.
 *
 * Verifies:
 *   • Search page renders for Individual role.
 *   • Category checkboxes available to Individuals are present: Programs,
 *     Assessments, Events, Coaches, Companies. The "Individuals" category
 *     is gated and should not appear.
 *   • Submitting a search returns results without errors.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";

test.describe("Individual · Universal Search", () => {
  test("Kiran can open the search page and run a query", async ({ page }) => {
    await signInAs(page, "individualAssociated");

    await page.goto("/coaching-studio/search", { waitUntil: "domcontentloaded" });

    // Search input present.
    const searchInput = page.locator(
      'input[placeholder^="Search programs"]'
    );
    await expect(searchInput).toBeVisible({ timeout: 30_000 });

    // Allowed categories for Individual.
    for (const label of ["Programs", "Assessments", "Events", "Coaches", "Companies"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      });
    }

    // The "Individuals" category should NOT be available to an Individual.
    // (It's listed only for Company/Professional via getAllowedCategories.)
    const hasIndividualsTab = await page
      .locator('label:has(input[type="checkbox"])')
      .filter({ hasText: /^Individuals$/ })
      .count();
    expect(hasIndividualsTab, "Individuals category should be hidden from Individual role").toBe(0);

    // Run a search with a generic term that the fixtures likely contain.
    await searchInput.fill("leadership");
    await page.getByRole("button", { name: /^Search$/ }).click();

    // After submit, the form remains and either results or the empty-state
    // message should render. Wait for at least one resource card OR an
    // "Sorry, no results" / empty-state text. Either is a valid outcome.
    const settled = page.locator(
      'article, p:has-text("No results"), p:has-text("no matching")'
    );
    await expect(settled.first()).toBeVisible({ timeout: 20_000 });
  });
});
