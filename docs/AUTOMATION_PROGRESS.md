# StudioVerse — Automation Suite Progress

Tracker for the test automation rollout. One line per phase; updated at the end of each session.

## Phase status

| Phase | Status | Date | Notes |
|---|---|---|---|
| 0. Foundation | ✅ Complete | 2026-05-10 | Vitest + Playwright + rules-unit-testing wired; sanity tests pass on all three layers. |
| 1. Test cases — SuperAdmin | ✅ 12 passing · 1 skipped | 2026-05-11 | Full SA suite per user direction: wallet, resources, packages, edits. |
| 1. Test cases — Company | ✅ 3 passing · 2 skipped (product gap) | 2026-05-11 | Add coach, add coachee, cohort (no coach due to rules gap — documented). |
| 2. Functions integration | Not started | — | |
| 3. E2E smoke | Not started | — | |
| 4. E2E full | Not started | — | |
| 5. Coverage + TESTING_GUIDE.md | Not started | — | |

## Phase 0 — what's runnable now

| Layer | Command | Pre-req |
|---|---|---|
| Unit | `npm test` or `npm run test:unit` | none — runs immediately |
| Rules | `npm run test:rules` | `npm run emulator` running in another terminal |
| E2E | `npm run e2e` | none (Playwright auto-starts `npm run dev`) |
| Watch unit | `npm run test:watch` | none |
| Headed E2E | `npm run e2e:headed` | none |

## Phase 0 — files added

- `package.json` — devDeps + scripts
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/helpers/emulator.ts` — emulator constants + reachability check
- `tests/helpers/seed.ts` — fixture skeletons (populated in Phase 1)
- `tests/helpers/auth.ts` — sign-in skeleton (populated in Phase 1)
- `tests/unit/sanity.test.ts` — Vitest wiring proof
- `tests/rules/sanity.test.ts` — rules-unit-testing wiring proof
- `e2e/sanity.spec.ts` — Playwright wiring proof
- `.gitignore` — added `playwright-report/`, `test-results/`, `.vitest-cache/`, `.npm-cache/`
- `docs/AUTOMATION_PROGRESS.md` — this file

## Phase 0 — verified

- ✅ Vitest unit sanity (2/2 passing) — alias `@` resolves to `src/`.
- ✅ Vitest rules sanity (2/2 passing) — `firestore.rules` loads, signed-in/out paths verified.
- ✅ Playwright E2E sanity (2/2 passing) — dev server auto-starts; `domcontentloaded` waits avoid Next.js dev recompile timeouts.

## Phase 1 — what's runnable now

Full run:

```bash
npx playwright test e2e/superadmin/    # 10 passed · 3 skipped · ~1.3 min
```

| # | Test | File | Status |
|---|---|---|---|
| 1a | SA · Wallet · Assign 500 credits → Company (Narendra) | `wallet-assign-credits.spec.ts` | ✅ |
| 1b | SA · Wallet · Assign 500 credits → Coach (Dinesh) | `wallet-assign-credits.spec.ts` | ✅ |
| 1c | SA · Wallet · Assign 500 credits → Individual (Kartik) | `wallet-assign-credits.spec.ts` | ✅ |
| 2 | SA · Resources · Create Program (with coin.png) | `create-program.spec.ts` | ✅ |
| 3 | SA · Resources · Create Event (with coin.png) | `create-event.spec.ts` | ✅ |
| 4 | SA · Resources · Edit Assessment (shortDescription, then revert) | `edit-assessment.spec.ts` | ✅ |
| 5 | SA · Earning Packages · Create Credit Package | `create-credit-package.spec.ts` | ✅ |
| 6 | SA · Earning Packages · Create Listing Package (Program) | `create-listing-package.spec.ts` | ✅ |
| 7 | SA · Earning Packages · Create Promotion Package (Event) | `create-promotion-package.spec.ts` | ✅ |
| 10 | SA · Earning Packages · Create Bot Hero Package (4 weeks = 1 month) | `create-bot-hero-package.spec.ts` | ✅ |
| 8 | SA · Resources · Edit Program (draft mode, no publish) | `edit-program-attach-listing-package.spec.ts` | ✅ |
| 9 | SA · Resources · Edit Event (draft mode, no promote) | `edit-event-attach-promotion-package.spec.ts` | ✅ |
| - | SA · Users · Create Company (legacy) | `create-company.spec.ts` | ⚠️ Skipped — Narendra is pre-provisioned |

## Phase 1 — Company suite

| # | Test | File | Status |
|---|---|---|---|
| C-1 | Company · Create Program | `e2e/company/create-program.spec.ts` | ⚠️ Skipped — product gap (UI shows alert "Create program feature coming soon") |
| C-2 | Company · Create Event | `e2e/company/create-event.spec.ts` | ⚠️ Skipped — product gap (UI shows alert "Create event feature coming soon") |
| C-3 | Company · Manage Users · Add Coach (associate Dinesh) | `e2e/company/add-coach.spec.ts` | ✅ |
| C-4 | Company · Manage Users · Add Coachee (associate Kartik) | `e2e/company/add-coachee.spec.ts` | ✅ |
| C-5 | Company · Manage Cohorts · Create Cohort with Coach Shilpa + Kartik + Kiran (status: active) | `e2e/company/create-cohort.spec.ts` | ✅ |

### Known gaps surfaced by the Company suite

1. **Company-side Program/Event creation is not implemented.** Both buttons currently fire `alert("Create … feature coming soon")` — no form path to exercise. SA-side create flow is covered.
2. **Cohort + coach-assignment rule** (resolved 2026-05-11): originally blocked by a `/users` update rule that compared `currentCompanyId()` (== Company's own `associatedCompanyId`, which is null) instead of the Company's own uid. User patched the rule and C-5 now passes with the full original scope.

### Notes on #8 and #9 scope

Per user direction 2026-05-11, scope was scaled back from "attach a Listing/Promotion Package" to "edit a field and save in draft mode". Reason: the Listing/Promotion Package selectors are gated behind "Publish now" / "Promote now" — ticking either triggers a Cloud Function validation cascade that an Admin-SDK-bootstrapped fixture doesn't satisfy. With the gate unchecked, the simpler edit-and-save path works.

Both tests create the resource via the UI inside the test (rather than direct Admin SDK write), then drive the Edit form. They also assert the resource appears on the Manage page list, not just in Firestore.

To restore the original attach-package scope later: in `beforeAll`, drive the Create form once via the UI to produce a schema-compliant draft, then tick Publish/Promote in the test and pick a package. Track as a follow-up if needed.

## Phase 1 — non-test files added in this session

- `tests/fixtures/test-phones.ts` — canonical 6-phone fixture + OTP constant.
- `tests/helpers/playwright-auth.ts` — `signInAs(page, key)` for the public phone-OTP flow with retry-on-recaptcha-not-ready.
- `tests/helpers/admin-firestore.ts` — Firebase Admin SDK helpers: `findUsersByPhone`, `deleteUserAndWalletByPhone`, `getWalletStateForUser`.
- `src/services/firebase.ts` — added gated `appVerificationDisabledForTesting=true` when `NEXT_PUBLIC_E2E=true` (test-only; never in dev/prod).
- `playwright.config.ts` — webServer command sets `NEXT_PUBLIC_E2E=true`; `reuseExistingServer: false` to guarantee env injection.

## Phase 0 — known knobs

- Playwright `goto()` calls use `waitUntil: "domcontentloaded"` (not the Playwright default `load`) because Next.js dev mode never settles "load" cleanly — HMR / preload chunks keep the network busy.
- `playwright.config.ts` `navigationTimeout: 60_000` — accommodates Next.js cold-compile on first request to a route. Tighten later if/when E2E runs against a built `next start`.

## Decisions baked in

- **Test layout**: `tests/unit/`, `tests/rules/`, `e2e/` (separate folders, not colocated).
- **Emulator targets**: local only. No reads/writes against `studioverse-test` from tests.
- **Playwright browsers**: Chromium only for now; add WebKit/Firefox later if needed.
- **CI**: deferred — solo local workflow until user opts in.
- **Test project ID**: `studioverse-test-local` (rules-unit-testing sandbox; never touches real Firebase project).

## Next session — Phase 1 starting points

When you're ready, suggested order:

1. Wallet integrity unit tests — `transferCoins`, `assignCoins`, ledger reconciliation.
2. Rules tests for the recently-fixed surfaces:
   - `walletTransactions` read/create (May 9–10 fixes).
   - `assessmentReports` read (May 9 fix).
   - `wallets` company-credit arm (May 9 fix).
3. Auth/registration unit tests — saveUserProfile, registration bonus.

Each of these maps to specific cases in `TEST_CASES.md`.
