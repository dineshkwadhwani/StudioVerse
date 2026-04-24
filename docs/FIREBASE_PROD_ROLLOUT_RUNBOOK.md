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
- Wallet / Manage Wallet (E5) Firestore rollout requirements
- Activity Assignment (E7) Firestore collections, indexes, and rules requirements
- Role-based access menus (E8) routing and access confirmation requirements
- Manage Users for Company/Professional (E10) scoped creation and association rollout requirements
- Multi-tenant content sharing (Apr 2026) — Programs/Events/Assessments published to multiple tenants

## First-time production project bootstrap (when `studioverse-prod` does not exist yet)

Use this section when production project creation is pending. Follow these steps in order so all production attributes, artifacts, and components are provisioned correctly the first time.

### A) Create and bind the Firebase production project

1. Create Firebase/GCP project in the Firebase Console with project id: `studioverse-prod` (or final approved equivalent).
2. In local repo, add alias mapping:
  ```bash
  npx -y firebase-tools@latest use --add studioverse-prod
  ```
3. Verify alias resolution:
  ```bash
  npx -y firebase-tools@latest use
  ```

Expected state:
- `prod` alias points to `studioverse-prod` in `.firebaserc`
- Local deploy commands can target prod safely with `--project studioverse-prod`

### B) Initialize mandatory Firebase services in prod

Enable and initialize these services before deploying application artifacts:

1. Firestore (Native mode) in intended production region.
2. Cloud Storage bucket for `studioverse-prod`.
3. Firebase Authentication (enable required sign-in methods used by app flows).
4. Cloud Functions APIs (via first deploy or API enablement).

Expected state:
- Firestore database exists and accepts rules/index deployment.
- Storage exists and accepts `storage.rules` deployment.
- Auth is enabled and can accept authorized domains.

### C) Configure production runtime attributes (before go-live)

Configure these in production hosting/runtime platform (and any server runtime used by app routes):

1. Public web Firebase vars:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
2. Server/runtime secrets:
  - `GROQ_API_KEY`
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`
  - `SUPERADMIN_SEED_KEY` (if seed endpoint is used)
3. Firebase Auth authorized domains:
  - Add exact production hostnames (all tenant domains/subdomains that will host login).

Expected state:
- Web SDK points to prod Firebase project.
- Server routes using Admin SDK are authenticated for prod.
- OTP/auth flows are valid for production domains.

### D) Deploy Firebase artifacts in strict order

Run from release commit after successful local builds.

1. Build verification:
  ```bash
  npm run build
  npm --prefix functions run build
  ```
2. Deploy indexes:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only firestore:indexes
  ```
3. Deploy Firestore rules:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only firestore:rules
  ```
4. Deploy Storage rules:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only storage
  ```
5. Deploy Functions (if release includes backend changes):
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only functions
  ```

Expected state:
- Production has the same rules/index/function artifacts as the approved release.

### E) Seed minimum production data components

Before opening production traffic, ensure these core data components exist:

1. Superadmin bootstrap path is usable (`seedInitialSuperadmin` or approved manual setup).
2. Tenant records exist for all supported tenant ids:
  - `coaching-studio`
  - `training-studio`
  - `recruitment-studio`
3. Role-scoped users and associations are testable (company/professional/individual).
4. Wallet baseline behavior is validated:
  - new scoped users receive initial issuance (10 coins)
  - wallet transaction ledger receives initial credit row

Expected state:
- Authenticated app shell routes have required tenant and role data.
- Manage Users and Manage Wallet flows can execute in prod without data bootstrap gaps.

### F) First-instance smoke tests (must pass before cutover)

1. Tenant route reachability:
  - `/<tenant>/dashboard`
  - `/<tenant>/manage-users`
  - `/<tenant>/manage-wallet`
2. Scoped user creation (`/api/users/create-scoped`):
  - company can create professional + individual
  - professional can create individual only
3. Wallet flow:
  - initial 10-coin issuance appears for newly created scoped users
  - request/approve/deny coin request flow works with expected role permissions
4. Content visibility:
  - programs/events/assessments reflect tenant scope (`tenantId` OR `tenantIds`)

Do not announce production readiness until all items above pass in prod.

### G) Day-1 provisioning command block (copy-paste)

Use this block as an operator checklist when creating the first production instance.
Replace placeholders before execution.

```bash
# --------- set once for this shell ---------
export PROD_PROJECT_ID="studioverse-prod"
export PROD_ALIAS="prod"
export BILLING_ACCOUNT_ID="<REPLACE_BILLING_ACCOUNT_ID>"

# --------- prereq checks ---------
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login

# --------- create/attach Firebase project ---------
# If project is already created in console, skip project create and only run use --add.
npx -y firebase-tools@latest projects:create "$PROD_PROJECT_ID" --display-name "StudioVerse Prod"
npx -y firebase-tools@latest use --add "$PROD_PROJECT_ID"
npx -y firebase-tools@latest use "$PROD_PROJECT_ID"
npx -y firebase-tools@latest use

# --------- optional: link billing in GCP (if not already linked via console) ---------
# gcloud beta billing projects link "$PROD_PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"

# --------- baseline artifact deployment ---------
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only firestore:indexes
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only firestore:rules
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only storage

# --------- functions (only if release includes backend changes) ---------
npm --prefix functions run build
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only functions

# --------- final verification ---------
npx -y firebase-tools@latest use
npx -y firebase-tools@latest projects:list | rg "$PROD_PROJECT_ID"
```

Operational reminder:
- Configure production runtime environment variables/secrets and Firebase Auth authorized domains before opening live traffic.
- Run first-instance smoke tests in section F before declaring go-live.

### H) Repeat release deploy block (project already exists)

Use this block for normal production releases after the first instance is already provisioned.

```bash
# --------- set once for this shell ---------
export PROD_PROJECT_ID="studioverse-prod"

# --------- verify target project ---------
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use "$PROD_PROJECT_ID"
npx -y firebase-tools@latest use

# --------- build from approved release commit ---------
npm run build
npm --prefix functions run build

# --------- deploy artifacts in order ---------
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only firestore:indexes
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only firestore:rules
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only storage

# --------- deploy functions if backend changed ---------
npx -y firebase-tools@latest deploy --project "$PROD_PROJECT_ID" --only functions

# --------- post-deploy verification ---------
npx -y firebase-tools@latest use
npx -y firebase-tools@latest projects:list | rg "$PROD_PROJECT_ID"
```

Release reminder:
- For frontend-only releases with no backend changes, skip functions deploy.
- Execute the release-day smoke checks before announcing cutover completion.

## Refactor impact note (Apr 12, 2026)

Recent multi-tenant refactors (shared app-shell wrappers, tenant-prefixed route normalization,
domain/path proxy rewrites, and tenant-aware copy updates) are frontend/runtime changes.

For this refactor set, backend rollout impact is:

- no new Firebase Functions are required
- no Firebase Function redeploy is required solely for these refactors
- no Firestore index changes are required solely for these refactors
- no Firestore rules changes are required solely for these refactors
- no Storage rules changes are required solely for these refactors

Operational caveat:
- if a tenant route exists in code but has no corresponding document in `tenants`, UI may show
  an under-construction/provisioning state depending on gate logic. This does not require function deploys,
  but may require tenant document seeding as an environment data operation.

## Multi-tenant content sharing rollout note (Apr 19, 2026)

Programs, Events, and Assessments can now be published to multiple tenants from superadmin portal.
This feature introduces `tenantIds: string[]` field to content documents while retaining `tenantId` for backward compatibility.

Backend impact for production rollout:

- **Cloud Functions:** `createProgram`, `updateProgram`, `createEvent`, `updateEvent` schemas now accept `tenantIds` array
  - existing `tenantId` immutability checks are preserved during updates
  - `tenantIds` is written to Firestore payload alongside `tenantId`
  - no new functions required; existing callables are schema-extended
  - redeploy functions with updated schemas before enabling multi-tenant UI in production
- **Firestore indexes:** no new composite indexes required; existing single-field index on `tenantId` is retained
- **Firestore rules:** no rule changes required if current rules already grant write access for `tenantIds` alongside `tenantId`
  - existing doc-write rules that permit `tenantId` updates should permit `tenantIds` updates
  - test production rules against sample payloads containing both fields before cutover
- **Data migration:** existing production documents without `tenantIds` field will continue to work
  - tenant visibility logic: `item.tenantId === targetTenant || (item.tenantIds?.includes(targetTenant) ?? false)`
  - no backfill required for existing single-tenant documents

Operational checklist for rollout:
- Confirm `createProgram.ts` and `updateProgram.ts` handle `tenantIds` correctly
- Confirm `createEvent.ts` and `updateEvent.ts` handle `tenantIds` correctly
- Deploy function updates before enabling multi-tenant selection UI in staging/prod
- Test new multi-tenant admin flows against staging environment before prod cutover
- Smoke test content visibility across all selected tenants in staging

## Coin request auth-UID alignment note (Apr 24, 2026)

Company coin-request approval now assumes the canonical company identifier is the Firebase Auth UID.

Required production expectations:

- company user documents must be addressable at `users/{auth.uid}` for authenticated company users
- coin request documents in `coinRequests` must store `companyId = companyAuthUid`
- company approval/read rules in `firestore.rules` now allow direct auth UID matching for `companyId`
- professional request flow must resolve any legacy `associatedCompanyId` value back to the company auth UID before writing a coin request

Operational checklist:

- deploy updated `firestore.rules` before testing company Manage Wallet coin-request flows
- verify a professional-created coin request stores company auth UID in `coinRequests.companyId`
- verify company user can open Manage Wallet and view pending requests without permission errors
- verify approve/deny still updates status and coin transfer correctly after rules deploy

## Source of truth files
These files are the canonical definitions that must be promoted to production:

- Firebase project/deploy config: `firebase.json`
- Firebase project aliases: `.firebaserc`
- Firestore indexes: `firestore.indexes.json`
- Firestore security rules: `firestore.rules`
- Storage security rules: `storage.rules`
- Function exports: `functions/src/index.ts`
- Program callable functions: `functions/src/programs/createProgram.ts`, `functions/src/programs/updateProgram.ts`
- Program schema/business rules: `functions/src/programs/programSchemas.ts` (includes `tenantIds` array validation)
- Program types/schema model: `src/types/program.ts` (includes `tenantIds: string[]` in form/record/write shapes)
- Program validation schema: `src/lib/validation/program.schema.ts` (enforces ≥1 tenant selection)
- Program service: `src/services/programs.service.ts` (tenant-scope matching for multi-tenant support)
- Program admin forms: `src/modules/admin/ProgramForm.tsx` (multi-select checkbox UI with primary lock badge during edit)
- Program admin section: `src/modules/admin/ProgramsSection.tsx` (defaults/hydration for tenantIds)
- Event callable functions: `functions/src/events/createEvent.ts`, `functions/src/events/updateEvent.ts`
- Event schema/business rules: `functions/src/events/eventSchemas.ts` (includes `tenantIds` array validation)
- Event types/schema model: `src/types/event.ts` (includes `tenantIds: string[]` in form/record/write shapes)
- Event validation schema: `src/lib/validation/event.schema.ts` (enforces ≥1 tenant selection)
- Event service: `src/services/events.service.ts` (tenant-scope matching for multi-tenant support)
- Event admin forms: `src/modules/admin/EventForm.tsx` (multi-select checkbox UI with primary lock badge during edit)
- Event admin section: `src/modules/admin/EventsSection.tsx` (defaults/hydration for tenantIds)
- Assessment admin module: `src/modules/admin/AssessmentsSection.tsx` (includes `tenantIds` multi-select support)
- Assessment types/schema model: `src/types/assessment.ts` (includes `tenantIds: string[]` in form/record shapes)
- Assessment service: `src/services/assessment.service.ts` (tenant-scope matching for multi-tenant support)
- Assessment AI question generation route: `src/app/api/assessments/generate-questions/route.ts`
- Wallet types/schema model: `src/types/wallet.ts`
- Wallet client service / transaction logic: `src/services/wallet.service.ts`
- Assignment types/schema model: `src/types/assignment.ts`
- Assignment client service (search, create, recommend, fetch): `src/services/assignment.service.ts`
- Mail placeholder service: `src/services/mail.service.ts`
- User Manage Wallet page: `src/modules/coaching-studio/ManageWalletPage.tsx`
- User My activities page: `src/modules/coaching-studio/MyActivitiesPage.tsx`
- Shared audit helper: `functions/src/audit/writeAuditLog.ts`
- Scoped user-create API route: `src/app/api/users/create-scoped/route.ts`
- Manage Users tenant page module: `src/modules/users/pages/ManageUsersPage.tsx`
- Manage Users client service: `src/services/manage-users.service.ts`
- Firebase Admin bootstrap for server routes: `src/lib/firebase-admin.ts`
- Tenant manage-users routes:
  - `src/app/coaching-studio/manage-users/page.tsx`
  - `src/app/recruitment-studio/manage-users/page.tsx`
  - `src/app/training-studio/manage-users/page.tsx`
- Tenant-facing content pages (multi-tenant visibility support):
  - `src/modules/programs/pages/ProgramsPage.tsx` (uses tenant-scope helper)
  - `src/modules/events/pages/EventsPage.tsx` (uses tenant-scope helper)
  - `src/modules/tools/pages/ToolsPage.tsx` (uses tenant-scope helper)
  - `src/modules/landing/pages/LandingPage.tsx` (uses tenant-scope helper)
  - Coaching-specific versions: `CoachingProgramsPage.tsx`, `CoachingEventsPage.tsx`, `CoachingToolsPage.tsx`, `CoachingLandingPage.tsx` (all updated with tenant-scope helper)

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

E10 Manage Users note:
- Scoped user creation for Company/Professional runs via Next.js server route `src/app/api/users/create-scoped/route.ts`.
- This route uses Firebase Admin SDK (`adminAuth`, `adminDb`) and validates caller ID token + creator role before creating users.
- Creation path writes `users/{uid}` documents with association fields including:
  - `associatedCompanyId`
  - `associatedProfessionalId`
  - `createdByUserId`
  - `createdByRole`
- Manage Users listing reads are client-side Firestore queries through `src/services/manage-users.service.ts` and therefore require production Firestore rules coverage for Company/Professional scoped reads.

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
7. Ensure server-side Firebase Admin credentials are configured in deployed app runtime when not relying on platform ADC:
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`
8. Ensure Firebase Auth Authorized Domains includes the exact production hostname(s) used by the browser.
9. Confirm E10 Manage Users scoped creation behavior and associations:
  - Company can create `professional` and `individual` users only.
  - Professional can create `individual` users only.
  - Company-created users inherit creator tenant.
  - Professional-created individual sets `associatedProfessionalId` to creator.
  - Company-created individual optional coach assignment is restricted to same-company active professionals.
10. Confirm Firestore rules allow scoped `users` reads required by manage-users listing flows:
  - Company can read Professionals/Individuals within same tenant/company scope.
  - Professional can read Individuals associated to that Professional.
11. Confirm TypeScript production build passes with `npm run build` before deploy, including:
  - `/api/users/create-scoped`
  - `/<tenant>/manage-users` routes
12. Confirm `assessmentImageUrl`/`assessmentImagePath` fields are included in expected Firestore Assessment documents.
13. Confirm canonical tenant slug values use hyphenated ids such as `coaching-studio` consistently across `tenants`, `users`, `programs`, `events`, and `assessments`.
14. Confirm wallet collections are either intentionally empty or seeded as expected after any datastore reset.
15. Confirm superadmin bootstrap path is ready:
  - either master phone-based auto-seed flow is valid for the target environment,
  - or `seedInitialSuperadmin` can be executed with a configured `SUPERADMIN_SEED_KEY`.
16. Confirm Event callable schema parity for admin form fields:
  - `creditsRequired` and `cost` must be accepted by `functions/src/events/eventSchemas.ts`.
  - `eventSource` must be accepted by `functions/src/events/eventSchemas.ts` with allowed values `studioverse_manager` and `external`.
  - deploy Event callables (`createEvent`, `updateEvent`) before using new Event fields in production.
17. Confirm Assessment schema parity for admin form fields:
  - `creditsRequired` must be present in `assessments` documents written by admin flows.
  - review Firestore rules so assessment writes with `creditsRequired` are not blocked.
18. Confirm legacy data defaults for newly introduced numeric fields:
  - existing Event docs missing `creditsRequired`/`cost` should be treated as `0` in UI.
  - existing Assessment docs missing `creditsRequired` should be treated as `0` in UI.
19. Confirm `assignments` collection exists and is covered by Firestore rules before enabling assignment flows in production.
20. Confirm wallet debit behavior: assign-to-other debits the **assignor** wallet, not the assignee wallet. Validate this against implemented service logic before cutover.
21. Confirm zero-credit self-assignment bypass is intentional: assignments where `creditsRequired === 0` skip all wallet validation and write the assignment record directly.
22. Confirm auto-provisioning behavior for unknown assignees is acceptable: if an assignee is not found by phone/email search, the service creates a new `Individual` user record in `users` and initializes a zero-balance wallet before writing the assignment.
23. **Multi-tenant content sharing (Apr 2026):**
   - Confirm `createProgram` and `createEvent` functions accept `tenantIds` array in payload.
   - Confirm `updateProgram` and `updateEvent` functions preserve primary `tenantId` during immutability checks while allowing `tenantIds` updates.
   - Confirm Firestore rules allow writes of documents containing both `tenantId` and `tenantIds` fields.
   - Test multi-tenant admin flows: create Program/Event with multiple tenant selections, verify it appears in all selected tenant landing pages.
   - Test multi-tenant edit flows: ensure primary tenant remains locked while secondary tenants remain editable.
   - Deploy function updates before enabling multi-tenant UI in production.
   - Verify tenant-scope visibility logic: content should appear in all tenant routes where either `item.tenantId === targetTenant` OR `item.tenantIds?.includes(targetTenant)`.

## Release-day quick execution checklist

Use this condensed list during production cutover.

1. Set active project to prod and verify account:
  ```bash
  npx -y firebase-tools@latest use studioverse-prod
  npx -y firebase-tools@latest use
  ```
2. Build app and functions from release commit:
  ```bash
  npm run build
  npm --prefix functions run build
  ```
3. Confirm runtime variables are present in deployed environment:
  - Firebase public web vars
  - `GROQ_API_KEY`
  - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (or verified platform ADC)
4. Confirm Firebase Auth Authorized Domains include the exact production hostnames.
5. Deploy Firestore indexes:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only firestore:indexes
  ```
6. Deploy Firestore rules:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only firestore:rules
  ```
7. Deploy Storage rules:
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only storage
  ```
8. Deploy required cloud functions (if changed in release):
  ```bash
  npx -y firebase-tools@latest deploy --project studioverse-prod --only functions
  ```
9. Smoke test E10 routes and API:
  - `/<tenant>/manage-users`
  - `/api/users/create-scoped`
10. Validate E10 role scope behavior in prod:
  - Company can create Professional + Individual only.
  - Professional can create Individual only.
  - Associations (`tenantId`, `associatedCompanyId`, `associatedProfessionalId`) are written correctly.
11. Smoke test E4 assessment flows end-to-end:
  - question generation route
  - report generation/analyze route
  - style-aware report rendering
12. Confirm no P0/P1 issues in logs after first live transactions, then announce cutover complete.

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
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
  - required by `src/lib/firebase-admin.ts` when platform default credentials are not available.
  - ensure private key is stored with preserved line breaks (or escaped `\n`, converted server-side).

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

## E10 Manage Users rollout deltas (must complete before prod cutover)

### 1) App route and API availability
Confirm these are deployed and reachable in production:

- Tenant routes:
  - `/<tenant>/manage-users`
- Server route:
  - `/api/users/create-scoped`

### 2) Association and role-scope validation
Validate with production-like test accounts:

- Company user can create Professional.
- Company user can create Individual.
- Professional user can create Individual only.
- Company-created users inherit creator tenant automatically.
- Professional-created Individual gets `associatedProfessionalId = creator.id`.
- Company-created Individual optional coach selection accepts only same-company active Professionals.

### 3) Firestore security rule coverage for scoped listing
Because Manage Users list/read paths use client Firestore queries (`src/services/manage-users.service.ts`), production rules must allow:

- Company-scoped read access to Professionals and Individuals in same tenant/company scope.
- Professional-scoped read access to Individuals associated to that Professional.

Minimum deny behavior:
- deny cross-tenant reads,
- deny reads outside creator role scope,
- deny direct client writes for privileged user creation paths.

### 4) Server credential hardening
If production app runtime is not using platform default credentials, ensure:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

are configured for `src/lib/firebase-admin.ts` before enabling E10 flows.

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
  - explicit coverage for `wallets`, `walletTransactions`, and `assignments`.
  - own-user read access defined explicitly for user-facing wallet/profile/my-activities/dashboard flows where needed.
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
- `eventSource` (`studioverse_manager` | `external`)
- `creditsRequired` (number, non-negative)
- `cost` (number, non-negative)

Pre-prod validation:
1. Confirm admin Event form sends `eventSource`, `creditsRequired`, and `cost`.
2. Confirm callable validation accepts all three fields in `functions/src/events/eventSchemas.ts`.
3. Confirm Event list/detail views tolerate missing values in legacy docs:
  - missing `eventSource` defaults to `studioverse_manager`.
  - missing `creditsRequired`/`cost` default to `0`.

Prod smoke tests:
1. Create Event with `eventSource=external`, non-zero credits, and cost; verify all three fields persist in Firestore.
2. Edit same Event and change `eventSource` to `studioverse_manager`; verify source and numbers are updated.
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

## E5 Wallet / Manage Wallet rollout deltas

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
    - `transactionType` (`credit` for admin issuance, `debit` for assignment spend)
    - `coins`
    - `reason` (optional string — describes the transaction purpose)
    - `assignmentId` (optional — present on debit records created by assignment flow)
    - `activityType` (optional — `program` | `event` | `assessment`, present on assignment debit records)
    - `activityId` (optional — Firestore doc id of the activity, present on assignment debit records)
    - `createdBy`
    - `createdAt`

Wallet ownership rule (implemented April 2026):
- Assign-to-other debits the **assignor** wallet (the user who initiates the assignment), not the assignee wallet.
- Self-assignment debits the logged-in user's own wallet.
- Assignments where `creditsRequired === 0` bypass all wallet validation; no debit record is written.

### 2) Rules / access expectations
For production, rules must explicitly address wallet data:

- SuperAdmin-issued coin allocation must not be left protected only by temporary open rules.
- If the client-side transaction model is retained, writes must still be restricted to authorized admin identities.
- If wallet issuance is later migrated to Functions, update this runbook and restrict client writes further.

Current decision point:
- Wallet issuance (credit) is still client-side from SuperAdmin portal.
- Wallet debit is also client-side, triggered by the assignment flow in `assignment.service.ts`.
- Before prod rollout, explicitly choose one of these two supported paths:
  - keep client-side issuance/debit and implement tight role-based Firestore rules for `wallets` and `walletTransactions`
  - migrate issuance/debit to callable/backend logic and deny direct client writes for wallet collections

Do not roll to production while this remains implicit.

### 3) Indexes
No additional composite indexes are currently required for wallet issuance or My Wallet reads.

### 4) Smoke tests (prod)
After deployment, validate end-to-end:

1. SuperAdmin dashboard shows utilized/issued wallet summary tile.
2. Manage Wallet (SuperAdmin) loads wallet list with radio filters (All / Company / Professional / Individual).
3. Creating a wallet for a new user initializes it with zero balance.
4. Assigning coins updates `wallets/{userId}` totals correctly.
5. A `walletTransactions` credit ledger row is created for the issuance.
6. Coaching Studio dashboard Manage Wallet shows the correct balance for the logged-in user.
7. User Manage Wallet page (`/coaching-studio/manage-wallet`) shows the balance and full transaction history (credits and debits).
8. After an assign-to-other action where `creditsRequired > 0`, confirm a `debit` walletTransaction row exists for the assignor.

## E7 Activity Assignment rollout deltas

### 1) Firestore collections
Current assignment implementation persists these collections:

- `assignments`
  - auto id
  - fields:
    - `tenantId`
    - `activityType` (`program` | `event` | `assessment`)
    - `activityId`
    - `activityTitle`
    - `creditsRequired`
    - `cost` (optional)
    - `assignerId`
    - `assignerName`
    - `assigneeId`
    - `assigneePhone`
    - `assigneeEmail`
    - `assigneeFirstName`
    - `assigneeLastName`
    - `assigneeFullName`
    - `status` (`assigned` | `recommended` | `completed` | `cancelled`)
    - `coinsDeducted`
    - `notes` (optional)
    - `createdAt`
    - `updatedAt`

Both assigned and recommended records are written to the same `assignments` collection, distinguished by `status`.

Auto-provisioning behavior:
- If a searched assignee is not found by phone/email, the assignment service creates a new user document in `users` with `userType: "individual"` and a zero-balance wallet before writing the assignment.

### 2) Firestore indexes
The My activities page reads assignments by multiple identifier fields. Add these composite indexes before production cutover:

```json
{ "collectionGroup": "assignments", "fields": [{"fieldPath": "tenantId", "order": "ASCENDING"}, {"fieldPath": "assigneeId", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] },
{ "collectionGroup": "assignments", "fields": [{"fieldPath": "tenantId", "order": "ASCENDING"}, {"fieldPath": "assigneePhone", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] },
{ "collectionGroup": "assignments", "fields": [{"fieldPath": "tenantId", "order": "ASCENDING"}, {"fieldPath": "assigneeEmail", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] },
{ "collectionGroup": "assignments", "fields": [{"fieldPath": "tenantId", "order": "ASCENDING"}, {"fieldPath": "assignerId", "order": "ASCENDING"}, {"fieldPath": "createdAt", "order": "DESCENDING"}] }
```

Deploy indexes after updating `firestore.indexes.json`:

```bash
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only firestore:indexes
```

### 3) Firestore rules
`assignments` must be added to production rules:

Minimum expected behavior:
- Authenticated users can read assignment records where they are the assignee (by `assigneeId`, `assigneeEmail`, or `assigneePhone`).
- Authenticated users can read assignment records they created (where `assignerId` matches their uid).
- Write access restricted to authenticated users for creating new assignments.
- Admin can read all assignments within a tenant.
- No unauthenticated read or write access.

### 4) Auto-provisioning note
The assignment service creates new `users` documents for unknown assignees. The provisioned user record has no Firebase Auth account; it only exists in Firestore. The user can later register using the same phone/email and the identity will merge at the UI level. Ensure `users` write rules support creation by authenticated users, not just admins.

### 5) Smoke tests (prod)
After deployment, validate end-to-end:

1. Find an existing user by phone on the assignment modal.
2. Confirm the found user summary is shown read-only in the assignment confirmation stage.
3. Assign a program/event/assessment with `creditsRequired > 0` to an existing user.
4. Confirm an `assignments` document is created with `status: "assigned"`.
5. Confirm a `walletTransactions` debit record is created for the **assignor** wallet.
6. Confirm the assignee can see the item on `/coaching-studio/my-activities`.
7. Assign to an unknown user (non-existent phone/email).
8. Confirm a new `users` document and a zero-balance `wallets` document are created for the unknown assignee.
9. Recommend an activity (Recommend button) and confirm a `status: "recommended"` record is created in `assignments`.
10. Confirm recommendations appear under My activities for the recommended user.
11. Confirm self-assignment (Register Now / Try Now) creates a record with the logged-in user as both assigner and assignee.
12. Confirm self-assignment with `creditsRequired === 0` completes without any wallet validation.

## E8 Role-based menus rollout notes

No additional Firestore collections, indexes, or functions are required for E8.

Pre-prod checks:
- Confirm `/coaching-studio/my-activities` route resolves correctly for authenticated users.
- Confirm `/coaching-studio/manage-wallet` route resolves correctly for authenticated users.
- Confirm `/coaching-studio/profile` route resolves and requires authentication gating.
- Confirm SuperAdmin portal (`/admin`) shows Manage Wallet section and Assign Activity section.
- Confirm dropdown menus in both dashboard and shared logged-in header show the correct role-specific items from the E8 access matrix.

## Multi-tenant content sharing rollout deltas (Apr 19, 2026)

Programs, Events, and Assessments can now be published to multiple tenants from superadmin portal. This feature enables one Program/Event/Assessment doc to appear across all selected tenant routes without duplication.

### 1) Cloud Function updates
- `createProgram` and `updateProgram` in `functions/src/programs/` must be redeployed with updated schemas accepting `tenantIds: string[]`
- `createEvent` and `updateEvent` in `functions/src/events/` must be redeployed with updated schemas accepting `tenantIds: string[]`
- Immutability checks preserve primary `tenantId` during updates; `tenantIds` remains editable
- No new Functions required; existing callables are schema-extended

Deploy updated functions before enabling multi-tenant UI in production:
```bash
npm --prefix functions run build
npx -y firebase-tools@latest deploy \
  --project studioverse-prod \
  --only functions:createProgram,functions:updateProgram,functions:createEvent,functions:updateEvent
```

### 2) Firestore schema changes
New optional field added to content documents:

- `programs` collection:
  - `tenantIds: string[]` (optional, alongside existing `tenantId`)
  - existing single-tenant docs continue to work without migration
  - new multi-tenant docs have both fields populated

- `events` collection:
  - `tenantIds: string[]` (optional, alongside existing `tenantId`)
  - existing single-tenant docs continue to work without migration
  - new multi-tenant docs have both fields populated

- `assessments` collection:
  - `tenantIds: string[]` (optional, alongside existing `tenantId`)
  - existing single-tenant docs continue to work without migration
  - new multi-tenant docs have both fields populated

### 3) Firestore rules
No rule changes required if existing rules already permit writes of document fields alongside `tenantId`.

Pre-deploy validation:
- Confirm Firestore rules allow creation/update of documents containing both `tenantId` and `tenantIds` fields
- Test rule policy against sample payloads with both fields present before cutover
- Example: if rules check `data.tenantId == request.auth.uid`, ensure no conflict occurs when `data.tenantIds` is also present

### 4) Tenant visibility logic (client-side)
All tenant-facing pages updated to use tenant-scope helper:

**Visibility rule:** an item is shown if:
```
item.tenantId === selectedTenant || (item.tenantIds?.includes(selectedTenant) ?? false)
```

Updated pages:
- Shared: `ProgramsPage.tsx`, `EventsPage.tsx`, `ToolsPage.tsx`, `LandingPage.tsx`
- Coaching-specific: `CoachingProgramsPage.tsx`, `CoachingEventsPage.tsx`, `CoachingToolsPage.tsx`, `CoachingLandingPage.tsx`

### 5) Admin portal multi-tenant UI
- Program/Event tenant selector changed to checkbox multi-select in `ProgramForm.tsx` and `EventForm.tsx`
- Assessment tenant selector supports multi-select in `AssessmentsSection.tsx`
- During create: all tenants are selectable
- During edit: primary tenant is disabled and shows `"Primary (locked)"` badge; secondary tenants remain editable
- New CSS class `.primaryLockBadge` added to `SuperAdminPortal.module.css`

### 6) Pre-prod validation checklist

- [ ] Cloud Functions compiled and ready to deploy with multi-tenant schema support
- [ ] `createProgram.ts` accepts `tenantIds` array and writes it to Firestore
- [ ] `updateProgram.ts` preserves primary `tenantId`, allows `tenantIds` updates
- [ ] `createEvent.ts` accepts `tenantIds` array and writes it to Firestore
- [ ] `updateEvent.ts` preserves primary `tenantId`, allows `tenantIds` updates
- [ ] Firestore rules validated against payloads containing both `tenantId` and `tenantIds`
- [ ] Admin form UI shows multi-select checkboxes for tenant selection
- [ ] Primary tenant in edit mode shows locked badge and is uncheckable
- [ ] Test: create Program with 2 tenants, verify it appears on both tenant landing pages
- [ ] Test: edit Program, deselect non-primary tenant, verify it disappears from that tenant route
- [ ] Test: Assessment multi-select works bidirectionally (add/remove tenants)
- [ ] No TypeScript errors: `npm run build` passes
- [ ] No Function errors: `npm --prefix functions run build` passes

### 7) Prod rollout smoke tests

After deployment:

1. Create a Program/Event/Assessment with multiple tenant selections from superadmin portal
2. Verify the item appears on all selected tenant landing pages
3. Edit the multi-tenant item and add/remove secondary tenants (keep primary locked)
4. Verify visibility updates across tenant routes
5. Create a single-tenant item (compatibility check)
6. Verify single-tenant items continue to work as before
7. Verify list counts and filtering in admin sections reflect multi-tenant assignments correctly
8. Verify audit logs capture both `tenantId` and `tenantIds` in metadata where applicable

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
8. Smoke test Manage Wallet (SuperAdmin) issuance + user Manage Wallet balance/history read path.
9. Confirm audit log writes for create/update actions where applicable.
10. Smoke test activity assignment flow including found-user confirm stage, wallet debit, and My activities visibility for assignee.
11. Smoke test Recommend flow and confirm recommended item appears in assignee My activities.
12. Smoke test unknown assignee path and confirm auto-provisioned user and zero wallet are created.
13. Confirm role-based menus render correctly across company, professional, individual, and superadmin roles.

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
