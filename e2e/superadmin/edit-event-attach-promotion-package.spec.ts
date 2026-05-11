/**
 * SA-EVT-EDIT-001 — SuperAdmin edits an Event to use a Promotion Package.
 *
 * Currently SKIPPED for the same reason as the Program edit-attach test:
 * the Promotion Package selector in the Event form is gated behind the
 * "Promote now" checkbox, which requires the Event payload to pass the
 * Cloud Function's schema + business validation. An Admin-SDK-bootstrapped
 * Event currently fails that pass.
 *
 * Fix path: either (a) drive the create via the UI flow in beforeAll so the
 * fixture goes through the same normaliseEventForm path as production, or
 * (b) mirror eventWriteSchema in bootstrapDraftEvent. Track in
 * docs/AUTOMATION_PROGRESS.md.
 */

import { test } from "@playwright/test";

test.describe.skip("SuperAdmin · Resources · Edit Event → attach Promotion Package", () => {
  test("placeholder — see file header for the unblock plan", () => {
    // Implementation to be filled in once the bootstrap path is solid.
  });
});
