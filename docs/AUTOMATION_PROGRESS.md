# StudioVerse — Automation Suite Progress

Tracker for the test automation rollout. One line per phase; updated at the end of each session.

## Phase status

| Phase | Status | Date | Notes |
|---|---|---|---|
| 0. Foundation | ✅ Complete | 2026-05-10 | Vitest + Playwright + rules-unit-testing wired; sanity tests pass on all three layers. |
| 1. Test cases (driven by user, menu-by-menu) | 🟢 In progress | 2026-05-10 | First SA test live: `e2e/superadmin/create-company.spec.ts`. Auth helper + Admin SDK helpers in place. |
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

| Test | File | Maps to | Notes |
|---|---|---|---|
| SA · Users · Create Company | `e2e/superadmin/create-company.spec.ts` | USR-001 | Creates user `9168676738`, asserts user/wallet/credit-txn via Admin SDK. Idempotent: cleans up the phone before each run. |

Run a single SA test:

```bash
npx playwright test e2e/superadmin/create-company.spec.ts
```

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
