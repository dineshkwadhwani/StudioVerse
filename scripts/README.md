# Scripts

Operational scripts for StudioVerse. Run from repo root.

## DB Reset Scripts

Used to reset a Firestore project to a clean baseline so a fresh round of
end-to-end testing can be performed (create SuperAdmin → Company → Coach →
Coachee, etc.).

### `reset-firestore-test.mjs`

Hard-locked to project `studioverse-test`. Refuses to run against any other
project ID.

**Preserves:**

- `users` where `userType || profileType || role === "superadmin"`
- `programs`, `assessments`, `assessmentQuestions`, `events`, `tenants`
  (kept in full)
- All `treasury::*` wallets (reset to `100000` coins, not deleted)

**Wipes:**

- All non-superadmin users
- All non-treasury wallets
- Every other top-level collection

**Does not touch Firebase Auth users** — delete those manually from the
Firebase console.

**Required env** (read from `.env.local`):

- `FIREBASE_ADMIN_PROJECT_ID` (must equal `studioverse-test`)
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

**Usage:**

```bash
# Dry run — lists collections, no writes
npm run db:reset:test

# Execute the reset
npm run db:reset:test:confirm
```

Or directly:

```bash
node scripts/reset-firestore-test.mjs
node scripts/reset-firestore-test.mjs --confirm
```

### Adding a reset script for another environment

Copy `reset-firestore-test.mjs` to e.g. `reset-firestore-staging.mjs`, change
the hard-locked project ID check, and add matching `db:reset:staging` /
`db:reset:staging:confirm` entries to `package.json`. **Never** create a
script that targets the production project.
