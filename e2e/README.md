# StudioVerse Sanity Suite

End-to-end regression coverage across all four actors of the Coaching Studio MVP. Run this before merging any product change.

## Quick commands

```bash
npm run sanity           # full headless run (≈4–5 min)
npm run sanity:headed    # same, with a visible browser
npm run sanity:debug     # Playwright inspector — step through a test
npm run sanity:report    # open the last HTML report
```

## Scoping

```bash
npx playwright test e2e/superadmin/                       # one actor's tests
npx playwright test e2e/coach/assign-program.spec.ts      # one file
npx playwright test --grep "Cohort"                       # by test-name match
```

## Layout

```
e2e/
  superadmin/   13 tests — wallet, resources, packages, edits, create-company
  company/       5 tests — add coach/coachee, cohort, create program/event
  coach/         8 tests — create program/event, cohort, assign, bot-hero, request-coins
  individual/    4 tests — refer, self-register, my-activities, search
  sanity.spec.ts (Phase 0 wiring smoke)
```

## Prerequisites

- `.env.local` populated with `FIREBASE_ADMIN_*` credentials (used by `tests/helpers/admin-firestore.ts` for fixture setup and assertions).
- Firebase Auth test phone numbers in `studioverse-test` matching `tests/fixtures/test-phones.ts` (OTP `000000`).
- A clean dev environment — kill any stray `next dev` on port 3000 before running; the suite auto-spawns its own.

## What "passing" means here

Each test:
- Signs in as the actor via real phone-OTP flow.
- Drives the actual UI (no mocked components).
- Reads/writes against the real `studioverse-test` Firebase project for fixture state and assertions.
- Cleans up after itself (programs, events, cohorts, packages, assignments, referrals) except for delta-tracked wallet credits.

## Known stable side effects

- `superadmin/wallet-assign-credits.spec.ts` adds +500 coins to each of Narendra, Dinesh, and Kartik on every run (delta-based assertions don't care about absolute balances).
- `coach/buy-bot-hero.spec.ts` creates a pending bot-hero request and debits Shilpa's wallet by 1000.
- `coach/request-coins.spec.ts` cleans up its own request in beforeEach/afterEach.

## Adding a test

1. Pick the actor folder.
2. Mirror an existing spec's structure — most use the same patterns (`signInAs`, `bootstrapDraftProgram`, etc.).
3. Use `tests/helpers/admin-firestore.ts` for fixture setup and assertions.
4. Use `tests/helpers/playwright-auth.ts` for sign-in.
5. Use `tests/helpers/playwright-forms.ts` `fieldByLabel` for forms without stable IDs.
6. Test should be idempotent — cleanup in `beforeEach` or `afterAll`.

See `docs/AUTOMATION_PROGRESS.md` for the latest snapshot of suite status.
