import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    // Next.js dev mode compiles routes on-demand; first request to a route
    // can take 20s+. Give navigation generous headroom; tighten in CI later.
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.E2E_NO_WEB_SERVER
    ? undefined
    : {
        // NEXT_PUBLIC_E2E=true switches src/services/firebase.ts into a mode
        // that disables reCAPTCHA app-verification, so pre-provisioned test
        // phones can sign in headlessly. Strictly opt-in.
        command: "NEXT_PUBLIC_E2E=true npm run dev",
        url: baseURL,
        timeout: 120_000,
        // Always start a fresh dev server so the E2E env var is guaranteed
        // to be set. Reusing an existing server (started outside of this
        // command) would skip the env injection and reCAPTCHA would block.
        reuseExistingServer: false,
      },
});
