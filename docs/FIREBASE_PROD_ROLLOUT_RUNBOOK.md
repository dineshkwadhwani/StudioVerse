# Firebase Production Rollout Runbook (StudioVerse)

## Purpose
This is the single reference to replicate Firebase backend definitions from `studioverse-test` to `studioverse-prod` quickly and safely.

Scope covered:
- Cloud Functions
- Firestore indexes
- Firestore rules
- Storage rules
- Program/Event backend schemas used by callable functions
- Assessment Centre (E4) Firestore + Storage rollout requirements
- Wallet / Manage Coins (E5) Firestore rollout requirements

## Source of truth files
These files are the canonical definitions that must be promoted to production:

- Firebase project/deploy config: `firebase.json`
- Firebase project aliases: `.firebaserc`
- Firestore indexes: `firestore.indexes.json`
- Firestore security rules: `firestore.rules`
- Storage security rules: `storage.rules`
- Function exports: `functions/src/index.ts`
- Program callable functions: `functions/src/programs/createProgram.ts`, `functions/src/programs/updateProgram.ts`
- Program schema/business rules: `functions/src/programs/programSchemas.ts`
- Event callable functions: `functions/src/events/createEvent.ts`, `functions/src/events/updateEvent.ts`
- Event schema/business rules: `functions/src/events/eventSchemas.ts`
- Assessment admin module: `src/modules/admin/AssessmentsSection.tsx`
- Assessment types/schema model: `src/types/assessment.ts`
- Assessment AI question generation route: `src/app/api/assessments/generate-questions/route.ts`
- Wallet types/schema model: `src/types/wallet.ts`
- Wallet client service / transaction logic: `src/services/wallet.service.ts`
- Shared audit helper: `functions/src/audit/writeAuditLog.ts`

## Currently exported production-relevant functions
From `functions/src/index.ts`:

- `createProgram` (callable, region `asia-south1`)
- `updateProgram` (callable, region `asia-south1`)
- `createEvent` (callable, region `asia-south1`)
- `updateEvent` (callable, region `asia-south1`)
- `testGroqPrompt` (exported function for AI prompt testing)
- `seedInitialSuperadmin` (HTTP request function)

Assessment note:
- There is currently no Firebase callable for Assessment generation/authoring.
- Assessment question generation currently runs through Next.js server route `src/app/api/assessments/generate-questions/route.ts` and requires `GROQ_API_KEY` in the deployed app environment.
- Assessment writes are currently done from `src/modules/admin/AssessmentsSection.tsx` directly to Firestore, so any assessment schema field additions (for example `creditsRequired`) require Firestore rules compatibility checks even when no new callable function is deployed.

Wallet note:
- There is currently no Firebase callable for wallet issuance.
- Wallet issuance is currently implemented through client-side Firestore transaction logic in `src/services/wallet.service.ts`.
- Production rules must therefore explicitly protect `wallets` and `walletTransactions` from unauthorized client writes.

## Current Firestore index set
From `firestore.indexes.json`:

- `users`: (`userType`, `phoneE164`, `status`)
- `users`: (`userType`, `name`)
- `programs`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `status`, `publicationState`, `promoted`, `eventDateTime`)
- `assessments`: (`tenantId`, `createdAt desc`)
- `assessmentQuestions`: (`assessmentId`, `displayOrder asc`)
- `assessmentQuestions`: (`assessmentId`, `isActive`, `displayOrder asc`)

Wallet index note:
- No additional composite indexes are currently required for `wallets` or `walletTransactions`.
- Current wallet reads are document-by-id (`wallets/{userId}`), full collection summary scan (`wallets`), and client-side transaction write.
- If admin transaction-history filtering is added later, add indexes at that time rather than pre-creating speculative indexes.

## One-time setup for project aliases
Run once per developer machine/repo clone:

```bash
npx -y firebase-tools@latest use --add studioverse-test
npx -y firebase-tools@latest use --add studioverse-prod
```

Then set active project as needed:

```bash
npx -y firebase-tools@latest use studioverse-test
npx -y firebase-tools@latest use studioverse-prod
```

## Pre-production checklist
Before any prod deploy:

1. Confirm active branch/commit is approved for release.
2. Build Functions locally:
   ```bash
   npm --prefix functions run build
   ```
3. Confirm active Firebase project is `studioverse-prod`:
   ```bash
   npx -y firebase-tools@latest use
   ```
4. Review rules expiry dates in `firestore.rules` and `storage.rules`.
5. Ensure all required web Firebase environment variables are configured in the deployed app runtime:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
6. Ensure server-side AI environment is configured in the deployed app runtime:
  - `GROQ_API_KEY`
7. Ensure Firebase Auth Authorized Domains includes the exact production hostname(s) used by the browser.
8. Confirm `assessmentImageUrl`/`assessmentImagePath` fields are included in expected Firestore Assessment documents.
9. Confirm canonical tenant slug values use hyphenated ids such as `coaching-studio` consistently across `tenants`, `users`, `programs`, `events`, and `assessments`.
10. Confirm wallet collections are either intentionally empty or seeded as expected after any datastore reset.
11. Confirm superadmin bootstrap path is ready:
  - either master phone-based auto-seed flow is valid for the target environment,
  - or `seedInitialSuperadmin` can be executed with a configured `SUPERADMIN_SEED_KEY`.
12. Confirm Event callable schema parity for admin form fields:
  - `creditsRequired` and `cost` must be accepted by `functions/src/events/eventSchemas.ts`.
  - deploy Event callables (`createEvent`, `updateEvent`) before using new Event fields in production.
13. Confirm Assessment schema parity for admin form fields:
  - `creditsRequired` must be present in `assessments` documents written by admin flows.
  - review Firestore rules so assessment writes with `creditsRequired` are not blocked.
14. Confirm legacy data defaults for newly introduced numeric fields:
  - existing Event docs missing `creditsRequired`/`cost` should be treated as `0` in UI.
  - existing Assessment docs missing `creditsRequired` should be treated as `0` in UI.

## Production environment and platform configuration

### 1) Web app runtime variables
These variables are required by `src/services/firebase.ts` for production web app bootstrap:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### 2) Server-side runtime variables
These variables are required for server-side and function-backed operational flows:

- `GROQ_API_KEY`
  - required by `src/app/api/assessments/generate-questions/route.ts`
- `SUPERADMIN_SEED_KEY`
  - required by `seedInitialSuperadmin` in `functions/src/index.ts`

### 3) Firebase Auth authorized domains
Phone OTP validation in deployed environments depends on exact host authorization.

Production checklist:
- add the production hostname to Firebase Auth Authorized Domains.
- add any staging / preview hostnames that must support OTP validation.
- validate using the exact same hostname shown in the browser address bar.

Operational note:
- localhost is suitable for configured Firebase test numbers.
- real-number OTP validation must be tested on deployed HTTPS domains.

### 4) Firebase project / alias hygiene
Confirm `.firebaserc` maps both aliases correctly before prod rollout:
- `studioverse-test`
- `studioverse-prod`

## E4 Assessment Centre rollout deltas (must complete before prod cutover)

### 1) Firestore indexes
Update `firestore.indexes.json` with Assessment indexes before production deploy:

- `assessments` index:
  - `tenantId` ASC
  - `createdAt` DESC

- `assessmentQuestions` index:
  - `assessmentId` ASC
  - `displayOrder` ASC

Then deploy indexes:

```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only firestore:indexes
```

Assessment schema fields currently persisted in Firestore:
- `assessments`
  - `tenantId`
  - `name`
  - `shortDescription`
  - `longDescription`
  - `assessmentImageUrl`
  - `assessmentImagePath`
  - `assessmentContext`
  - `assessmentBenefit`
  - `assessmentType`
  - `renderStyle`
  - `creditsRequired`
  - `questionBankCount`
  - `questionsPerAttempt`
  - `analysisPrompt`
  - `questionGenerationPrompt`
  - `status`
  - `publicationState`
  - `ownershipScope`
  - `ownerEntityId`
  - `createdBy`
  - `updatedBy`
  - `createdAt`
  - `updatedAt`
  - `publishedAt`
- `assessmentQuestions`
  - `assessmentId`
  - `tenantId`
  - `questionText`
  - `questionType`
  - `renderStyle`
  - `options`
  - `correctAnswers` (array)
  - `scoringRule`
  - `imageUrl`
  - `imageDescription`
  - `displayOrder`
  - `weight`
  - `tags`
  - `isActive`
  - `createdAt`
  - `updatedAt`

### 2) Firestore rules
Current `firestore.rules` is still temporary open access with an expiry date.
For production, replace it with least-privilege rules that explicitly cover at minimum:

- `users`
- `tenants`
- `programs`
- `events`
- `assessments`
- `assessmentQuestions`
- `wallets`
- `walletTransactions`

Minimum expected behavior:
- reads/writes for admin collections restricted to authenticated superadmin/company admin roles.
- tenant-aware checks for tenant-scoped records.
- explicit coverage for `wallets` and `walletTransactions`.
- own-user read access defined explicitly for user-facing wallet/profile/dashboard flows where needed.
- superadmin user bootstrap path preserved without leaving broad open writes in place.
- deny-by-default catch-all at end of rules.

Wallet minimum expected behavior:
- `wallets`
  - read allowed to the owning authenticated user and permitted admins.
  - write allowed only to privileged admin roles or trusted backend paths.
- `walletTransactions`
  - read restricted to privileged admins and, if desired later, the owning user.
  - direct client writes should be denied unless the issuance flow remains intentionally client-trusted.

### 3) Storage rules
Current `storage.rules` is still temporary open access with an expiry date.
For production, add explicit path-level rules for assessment images:

- `assessments/{tenantId}/{assessmentId}/cover.{ext}`

Also review any existing program/event thumbnail upload paths used by the app:

- `events/{tenantId}/{eventId}/thumbnail.{ext}`
- any program thumbnail storage path currently used by the admin flow

Minimum expected behavior:
- write restricted to admin-capable authenticated roles.
- read policy based on intended exposure (public assessment catalog vs authenticated-only app view).
- deny-by-default for unspecified paths.

### 4) App/server environment
Assessment generation depends on server-side environment:

- `GROQ_API_KEY` must be set in production runtime.
- no AI API key should be exposed via client-side env vars.
- Firebase public web config vars must be present in the deployed frontend runtime.
- Firebase Auth Authorized Domains must include exact deployed hostnames.

### 4A) Superadmin bootstrap / seeding
Current superadmin bootstrap options:

1. Auto-seed path
  - `ensureSuperadminProfile` can seed the master superadmin when login occurs with the configured master phone number.
  - this path depends on Firebase Auth OTP working correctly in the target deployed hostname.

2. HTTP seed function path
  - `seedInitialSuperadmin` is exported from `functions/src/index.ts`.
  - requires `SUPERADMIN_SEED_KEY` to be configured.
  - requires a POST request with `x-seed-key` header.

Recommended production practice:
- configure `SUPERADMIN_SEED_KEY` before cutover.
- use the HTTP seed function only as a controlled bootstrap/recovery mechanism.
- verify at least one active superadmin document exists before opening admin access.

### 5) Assessment smoke tests (prod)
After deployment, validate end-to-end:

1. SuperAdmin creates Assessment with metadata.
2. Assessment `creditsRequired` value is saved and visible after edit/reload.
3. Assessment-level image uploads and URL/path are persisted.
4. AI question generation returns parsed rows and table shows them.
5. Edit Assessment loads existing questions.
6. Get More appends questions; save inserts only newly appended rows.
7. Dashboard tile “Total Assessments” reflects `assessments` collection count.

## Event field rollout notes (credits + cost)

Event schema fields currently expected for admin create/update:
- `creditsRequired` (number, non-negative)
- `cost` (number, non-negative)

Pre-prod validation:
1. Confirm admin Event form sends both fields.
2. Confirm callable validation accepts both fields in `functions/src/events/eventSchemas.ts`.
3. Confirm Event list/detail views tolerate missing values in legacy docs (default to `0`).

Prod smoke tests:
1. Create Event with non-zero credits and cost; verify fields persist in Firestore.
2. Edit same Event and update both numbers; verify values are updated.
3. Open Event in tenant-facing pages and verify no runtime/serialization errors.

### Latest deployment validation (Apr 12, 2026)

Validated in `studioverse-test`:
- `updateEvent` update completed successfully.
- `createEvent` initially reported a client-side timeout in a combined deploy run, then completed successfully when redeployed alone.
- `createProgram` and `updateProgram` remain deployed and active.

Verified callable set currently present in test:
- `createEvent` (v2, callable, `asia-south1`, nodejs24)
- `updateEvent` (v2, callable, `asia-south1`, nodejs24)
- `createProgram` (v2, callable, `asia-south1`, nodejs24)
- `updateProgram` (v2, callable, `asia-south1`, nodejs24)

Operational guidance for partial timeout scenarios:
1. If a combined deploy returns a timeout but one function already shows success, redeploy only the failed function.
2. Use:
  ```bash
  npx -y firebase-tools@latest deploy --only functions:createEvent --project studioverse-test --debug
  ```
  (replace function name as needed).
3. Confirm final state with:
  ```bash
  npx -y firebase-tools@latest functions:list --project studioverse-test
  ```
4. Treat CLI timeout output as inconclusive until function status is checked via `functions:list` or Cloud Console operation state.

Security note from debug deploys:
- `--debug` can print runtime environment values in logs.
- Do not share raw debug output externally; rotate any sensitive keys if they were exposed in terminal history.

## E5 Wallet / Manage Coins rollout deltas

### 1) Firestore collections
Current wallet implementation persists these collections:

- `wallets`
  - document id: `userId`
  - fields:
    - `userId`
    - `tenantId`
    - `userType`
    - `userName`
    - `totalIssuedCoins`
    - `utilizedCoins`
    - `availableCoins`
    - `createdBy`
    - `updatedBy`
    - `createdAt`
    - `updatedAt`

- `walletTransactions`
  - auto id
  - fields:
    - `walletId`
    - `userId`
    - `tenantId`
    - `userType`
    - `userName`
    - `transactionType` (`credit` currently implemented)
    - `coins`
    - `createdBy`
    - `createdAt`

### 2) Rules / access expectations
For production, rules must explicitly address wallet data:

- SuperAdmin-issued coin allocation must not be left protected only by temporary open rules.
- If the client-side transaction model is retained, writes must still be restricted to authorized admin identities.
- If wallet issuance is later migrated to Functions, update this runbook and restrict client writes further.

Current decision point:
- wallet issuance is still client-side.
- before prod rollout, explicitly choose one of these two supported paths:
  - keep client-side issuance and implement tight role-based Firestore rules for `wallets` and `walletTransactions`
  - migrate issuance to callable/backend logic and deny direct client writes for issuance collections

Do not roll to production while this remains implicit.

### 3) Indexes
No additional composite indexes are currently required for wallet issuance or My Wallet reads.

### 4) Smoke tests (prod)
After deployment, validate end-to-end:

1. SuperAdmin dashboard shows utilized/issued wallet summary tile.
2. Manage Coins loads tenants.
3. Selecting tenant + user type populates matching users.
4. Assign Coins updates `wallets/{userId}` totals correctly.
5. A `walletTransactions` credit ledger row is created.
6. Coaching Studio dashboard My Wallet panel reflects updated balance for the logged-in user.

## Production deploy commands
Use these commands from repository root.

### A) Deploy only Program + Event callables
```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only functions:createProgram,functions:updateProgram,functions:createEvent,functions:updateEvent
```

### B) Deploy all currently exported functions
```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only functions
```

### C) Deploy only security rules and indexes
```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only firestore:rules,firestore:indexes,storage
```

### D) Full backend deploy (functions + rules + indexes + storage)
```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only functions,firestore:rules,firestore:indexes,storage
```

## Post-deploy verification
1. Verify functions are updated:
   ```bash
   npx -y firebase-tools@latest functions:list --project studioverse-prod
   ```
2. Verify Firestore indexes are in READY state in Firebase Console.
3. Verify Firebase Auth Authorized Domains include the exact production hostname.
4. Smoke test OTP on deployed HTTPS domain using the exact browser hostname.
5. Verify at least one active superadmin record exists and can access the admin portal.
6. Smoke test admin Program/Event create + update flows against prod environment.
7. Smoke test admin Assessment create/edit + image upload + question append flows.
8. Smoke test Manage Coins issuance + My Wallet read path.
9. Confirm audit log writes for create/update actions where applicable.

## Datastore reset note (Apr 11, 2026)
During current development, Firestore was intentionally cleared to enable clean reseeding.

Implications for production rollout discipline:
- do not assume demo/test data exists after deploy.
- validate required seed records explicitly.
- preserve superadmin records before any destructive maintenance operation.
- if tenant-linked lookups fail unexpectedly, first verify canonical tenant ids and reseeded tenant/user documents.

## Change-management rule
Any change to Program/Event schema, callable payload validation, Firestore rules, storage rules, or indexes must update the source-of-truth files listed above in the same pull request.

If function names are added/removed, update this runbook immediately.
