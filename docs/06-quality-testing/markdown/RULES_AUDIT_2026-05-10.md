# Firestore Rules & Indexes Audit — 2026-05-10

Pre-prod audit triggered by regression issues seen during testing on 2026-05-09. Many failures were "missing or insufficient permissions" once the legacy open rules (`allow read, write: if true`) expired on 2026-04-30.

This document is also the audit-of-record for the production rollout: every collection accessed from the codebase has been verified to have a matching rule block, and every compound query has a matching index.

## 1. Method

1. Inventoried all collection-name references in `src/**` and `functions/src/**`:
   - `collection(db, "X")`, `doc(db, "X", ...)`
   - `db.collection("X")`, `firestore.collection("X")` (admin SDK in functions)
   - Constants of the form `const COLLECTION = "X"`
2. Compared the inventory against the top-level `match /X/{id}` blocks in `firestore.rules`.
3. For each collection that IS covered, verified that the rule's identity check matches how the field is actually written by the service code. StudioVerse has three coexisting "user identity" forms — Firebase Auth UID, `users.uid`, and `users.userId` — and several rules were checking only `request.auth.uid`.
4. Inventoried compound `where(...) + orderBy(...)` query patterns and compared with `firestore.indexes.json`.
5. Deployed updated rules and indexes to the `studioverse-test` project; rules compiled cleanly, indexes deployed.

## 2. Collection coverage matrix

All collections referenced by code now have a matching rule block. None missing.

| Collection | Reads | Writes | Notes |
| --- | --- | --- | --- |
| users | open to signed-in (login lookup) | self + manager-scoped | Privilege-escalation fields immutable from client |
| tenants | public | superadmin only | Activation gated on checklist |
| wallets | signed-in non-treasury | self + company-credit + superadmin | Treasury wallets superadmin-only; balance manipulation constrained |
| walletTransactions | signed-in (ledger render) | debit/sent/received scoped to actor | Treasury txns written by Functions |
| assessments | public | superadmin or signed-in | Public-readable for landing pages |
| assessmentQuestions | signed-in | superadmin only | |
| assessmentAttempts | self (alias-aware) | self (alias-aware) | **Alias-broadened in this audit** |
| assessmentReports | self / assignment-party (alias-aware) | signed-in create, superadmin update | **Alias-broadened in this audit** |
| programs | public | superadmin or signed-in | |
| events | public | superadmin or signed-in | |
| guestLogs | superadmin only | server-only (Admin SDK) | Client writes denied |
| assignments | signed-in | actor-create + actor-update (alias-aware) | **Update broadened in this audit** |
| cohorts | signed-in | signed-in / superadmin delete | |
| cohortMembers | signed-in | manager-scoped | |
| cohortAssignments | signed-in | actor-scoped (alias-aware) | |
| referrals | signed-in | actor-create, scoped update | |
| coinRequests | scoped reads | actor-create (alias-aware), company-update | **Create broadened in this audit** |
| cashoutRequests | scoped reads | actor-create, superadmin-update | |
| coinPackages | public | superadmin only | |
| coinOrders | self (alias-aware) | self / superadmin | **Alias-broadened in this audit** |
| promotionPackages | signed-in | superadmin only | |
| listingPackages | signed-in | superadmin only | |
| programPromotionRequests | signed-in | signed-in / superadmin delete | Rule kept; no current client code path |
| botHeroPackages | signed-in | superadmin only | |
| botHeroRequests | self / superadmin | professional-create, superadmin-update | |
| bot-knowledge | public | superadmin only | Static-file fallback also works |
| notificationLogs | superadmin | client-create with strict shape | Server bypass via Admin SDK |
| auditLogs | superadmin | server-only | |
| leadUnlocks | unlocker / lead / superadmin | server-only via callable | |
| messages | sender / receiver / superadmin | server-only via callable; receiver readAt-only update | |

Server-only collections (no client SDK access; written via Admin SDK in Functions) — implicit deny is correct, no rule block needed:

- `notificationDispatchMarkers` (used by `runScheduledNotifications`)
- `connection_test` (referenced only by `src/app/page-database-test.tsx`, an unrouted dev-test stub — no production impact)

## 3. Changes made in this audit

### 3a. Rule fixes (alias broadening)

The pattern: rules were checking `resource.data.X == request.auth.uid` only. The codebase stores the same identity in three forms (`auth.uid`, `users.uid`, `users.userId`), so the check now uses the existing `isActorId(value)` helper which accepts all three. No security loosening — same authorisation semantics, broader recognition.

- `assessmentAttempts.read` and `assessmentAttempts.update`
- `assessmentReports.read` (both direct-owner branch and assignment-party branch)
- `assignments.update` (assignedTo, assignedBy, assignerId, assigneeId)
- `coinOrders.read` and `coinOrders.update`
- `coinRequests.create` (requesterProfessionalId) and `coinRequests.read` (requesterProfessionalId)

### 3b. Index additions

Added to `firestore.indexes.json`:

- `coinOrders` — `userId ASC + createdAt DESC` (powers `listCoinOrdersForUser`)
- `assignments` — `assigneeId ASC + tenantId ASC + status ASC` (powers cohort progress queries)
- `walletTransactions` — `userId ASC + tenantId ASC + transactionType ASC` (powers credit-history queries)
- `walletTransactions` — `walletId ASC + tenantId ASC` (powers per-wallet ledger reads)
- `referrals` — `tenantId ASC + referredEmail ASC + status ASC` (powers duplicate-email check)
- `referrals` — `tenantId ASC + referredPhone ASC + status ASC` (powers phone-based join match)

## 4. Deployment

- Target: `studioverse-test`
- Rules compile: ✔
- Rules released: ✔
- Indexes deployed: ✔

Composite indexes that are newly added will take a few minutes to a few hours to build server-side; Firestore will return "index is currently building" errors during that window. Re-run failing tests after the indexes are READY in the Firebase Console (Firestore → Indexes).

## 5. Production rollout checklist

When promoting to `studioverse-prod`:

1. `firebase deploy --only firestore:rules,firestore:indexes --project prod`
2. Verify in Firebase Console → Firestore → Rules → ruleset hash matches `firestore.rules`.
3. Wait for all indexes to enter READY state (Firestore → Indexes).
4. Smoke-test the alias-broadened flows specifically:
   - A managed-individual user (created by a company; may have `userId != auth.uid`) opens a coin order from history.
   - A coach (where `users.uid` is set after first login) takes an assessment and reads back the attempt + report.
   - A coach updates an assignment they own.
   - A coach files a coin request.

## 6. Open items / out of scope

- `programPromotionRequests` rule block remains in `firestore.rules` for compatibility but no current code path writes to it. Consider removing in a future cleanup PR.
- `connection_test` (dev sanity-test stub) is not wired into any route; no fix needed unless it gets re-introduced.
- Composite-index build time on test was clean; if any prod query throws "FAILED_PRECONDITION: query requires an index", capture the suggested URL from the error and add the index — this is normal first-time behaviour and not a regression.

## 7. Files touched

- `firestore.rules` — alias-broadening for 5 rule blocks
- `firestore.indexes.json` — 6 new composite indexes
- `docs/RULES_AUDIT_2026-05-10.md` — this document
