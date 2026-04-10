# Firebase Production Rollout Runbook (StudioVerse)

## Purpose
This is the single reference to replicate Firebase backend definitions from `studioverse-test` to `studioverse-prod` quickly and safely.

Scope covered:
- Cloud Functions
- Firestore indexes
- Firestore rules
- Storage rules
- Program/Event backend schemas used by callable functions

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
- Shared audit helper: `functions/src/audit/writeAuditLog.ts`

## Currently exported production-relevant functions
From `functions/src/index.ts`:

- `createProgram` (callable, region `asia-south1`)
- `updateProgram` (callable, region `asia-south1`)
- `createEvent` (callable, region `asia-south1`)
- `updateEvent` (callable, region `asia-south1`)
- `seedInitialSuperadmin` (HTTP request function)

## Current Firestore index set
From `firestore.indexes.json`:

- `users`: (`userType`, `phoneE164`, `status`)
- `users`: (`userType`, `name`)
- `programs`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `updatedAt desc`)
- `events`: (`tenantId`, `status`, `publicationState`, `promoted`, `eventDateTime`)

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
4. Confirm audit log writes for create/update actions.

## Change-management rule
Any change to Program/Event schema, callable payload validation, Firestore rules, storage rules, or indexes must update the source-of-truth files listed above in the same pull request.

If function names are added/removed, update this runbook immediately.
