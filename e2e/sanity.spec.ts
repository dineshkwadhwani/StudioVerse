import { test, expect } from "@playwright/test";

// Next.js dev mode compiles routes on first request; subsequent navigations
// can also hit recompilation. Use `domcontentloaded` rather than the default
// `load` so we don't block on dev-only HMR/preload settling.

test.describe("Phase 0 sanity — Playwright wiring", () => {
  test("home page loads and returns a 2xx response", async ({ page }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.ok(), `Expected 2xx, got ${response?.status()}`).toBe(true);
  });

  test("page has a non-empty <title>", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
  });
});
