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
- Shared audit helper: `functions/src/audit/writeAuditLog.ts`

## Currently exported production-relevant functions
From `functions/src/index.ts`:

- `createProgram` (callable, region `asia-south1`)
- `updateProgram` (callable, region `asia-south1`)
- `createEvent` (callable, region `asia-south1`)
- `updateEvent` (callable, region `asia-south1`)
- `seedInitialSuperadmin` (HTTP request function)

Assessment note:
- There is currently no Firebase callable for Assessment generation/authoring.
- Assessment question generation currently runs through Next.js server route `src/app/api/assessments/generate-questions/route.ts` and requires `GROQ_API_KEY` in the deployed app environment.

## Current Firestore index set
From `firestore.indexes.json`:

- `users`: (`userType`, `phoneE164`, `status`)
- `users`: (`userType`, `name`)
- `programs`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `status`, `publicationState`, `promoted`, `eventDateTime`)

Required additions for E4 Assessment Centre production rollout:
- `assessments`: (`tenantId`, `createdAt desc`) for tenant-filtered admin list query.
- `assessmentQuestions`: (`assessmentId`, `displayOrder asc`) for deterministic ordered question loads (if orderBy is re-enabled).

Recommended addition for future runtime delivery:
- `assessmentQuestions`: (`assessmentId`, `isActive`, `displayOrder asc`).

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
5. Ensure `GROQ_API_KEY` is configured in the deployed app environment (Vercel/App Hosting).
6. Confirm `assessmentImageUrl`/`assessmentImagePath` fields are included in expected Firestore Assessment documents.

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

### 2) Firestore rules
Current `firestore.rules` is still temporary open access with an expiry date.
For production, replace it with least-privilege rules that explicitly cover at minimum:

- `assessments`
- `assessmentQuestions`
- existing Program/Event collections

Minimum expected behavior:
- reads/writes for admin collections restricted to authenticated superadmin/company admin roles.
- tenant-aware checks for tenant-scoped records.
- deny-by-default catch-all at end of rules.

### 3) Storage rules
Current `storage.rules` is still temporary open access with an expiry date.
For production, add explicit path-level rules for assessment images:

- `assessments/{tenantId}/{assessmentId}/cover.{ext}`

Minimum expected behavior:
- write restricted to admin-capable authenticated roles.
- read policy based on intended exposure (public assessment catalog vs authenticated-only app view).
- deny-by-default for unspecified paths.

### 4) App/server environment
Assessment generation depends on server-side environment:

- `GROQ_API_KEY` must be set in production runtime.
- no AI API key should be exposed via client-side env vars.

### 5) Assessment smoke tests (prod)
After deployment, validate end-to-end:

1. SuperAdmin creates Assessment with metadata.
2. Assessment-level image uploads and URL/path are persisted.
3. AI question generation returns parsed rows and table shows them.
4. Edit Assessment loads existing questions.
5. Get More appends questions; save inserts only newly appended rows.
6. Dashboard tile “Total Assessments” reflects `assessments` collection count.

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
3. Smoke test admin Program/Event create + update flows against prod environment.
4. Smoke test admin Assessment create/edit + image upload + question append flows.
5. Confirm audit log writes for create/update actions.

## Change-management rule
Any change to Program/Event schema, callable payload validation, Firestore rules, storage rules, or indexes must update the source-of-truth files listed above in the same pull request.

If function names are added/removed, update this runbook immediately.
