/**
 * Generic form-interaction helpers for Playwright tests.
 */

import type { Page, Locator } from "@playwright/test";

/**
 * Locate the first <input>, <select>, or <textarea> immediately following a
 * <label> with the given text. Useful for the SA portal's package forms,
 * which use the pattern `<label>Foo</label><input/>` without id/htmlFor
 * wiring.
 *
 * Accepts either a Page or any Locator so callers can scope to a modal /
 * dialog when there are multiple matching labels on the page.
 */
export function fieldByLabel(scope: Page | Locator, labelText: string): Locator {
  return scope.locator(
    `xpath=.//label[normalize-space()="${labelText}"]/following-sibling::*[self::input or self::select or self::textarea][1]`
  );
}
