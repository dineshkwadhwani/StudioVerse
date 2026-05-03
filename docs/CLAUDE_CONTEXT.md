# CLAUDE_CONTEXT.md — StudioVerse Working Context

This file contains richer working context for Claude Code. It is more detailed than `CLAUDE.md`, and should be used as supporting reference rather than a short always-on prompt.

## Product context

StudioVerse is the parent platform for multiple studio deployments. Each studio shares the same base architecture and app shell, but differs in branding, terminology, and selected behaviors.

### Studios

- Coaching Studio
- Training Studio
- Recruitment Studio

### Core intent

- One codebase.
- Shared modules where possible.
- Config-driven studio differences.
- Tenant-aware routing and data isolation.
- Firebase-backed data and auth.
- Vercel-hosted web app.

## Existing conventions

### Routing

- Next.js App Router is the standard.
- Routes live under `src/app/`.
- Domain and tenant resolution are handled through proxy/tenant routing utilities.
- Avoid inventing alternate route structures unless the docs require it.

### Data access

- Components should not query Firestore directly.
- Firestore reads/writes must go through services.
- Trust-sensitive operations should be implemented in Firebase Functions.

### Config separation

There are two major configuration surfaces:

1. Authenticated app-shell/studio config.
2. Marketing/landing-page content config.

Do not mix them.

## Implementation principles

- Prefer shared code over duplication.
- Use config for labels, branding, copy, and small behavior differences.
- Keep feature implementations reusable across studios.
- Use typed constants instead of magic strings.
- Keep security and isolation boundaries explicit.

## Current working areas from existing Copilot context

The repository has active work across:

- referral / wallet / coin issuance flows
- assignment and recommendation flows
- studio-level landing pages
- assessment and event management
- auth and session handling
- tenant-specific labels and routes
- email sending with Resend
- Bot Hero monetization (coach bot persona purchase)
- Guest Log lead capture from bot conversations

This context file should not try to reproduce every implementation detail. Those details belong in the deeper domain docs and feature docs.

## Latest architecture and security decisions (3 May 2026)

### Architecture decisions now treated as current baseline

- SuperAdmin portal uses sectioned dashboard metrics with tenant-aware filtering and deep links into operational modules.
- Approvals workflow supports direct tab targeting from dashboard tiles (promotion, cashout, listing, bot hero).
- Orders and Referrals admin screens use search-driven filter bars (explicit apply) rather than auto-fetch on every filter field change.
- Wallet management includes explicit treasury visibility in SuperAdmin Manage Wallet.
- Treasury wallets are backfilled on admin wallet load so legacy tenants are normalized into the current treasury model.

### Security decisions now treated as mandatory

- Guest and public flows never write directly to Firestore from the browser for trust-sensitive data.
- Bot referral and guest log writes are server-mediated through trusted API routes / Admin SDK paths.
- Treasury-affecting operations (registration bonus, referral reward, treasury backfill, debit return routing) run in trusted backend callables/triggers.
- Firestore rules enforce blocked client writes for protected collections and superadmin-only read where applicable.
- Idempotency markers are used for treasury/earnings return flows to prevent duplicate credits during retries.
- All secrets remain server-side (`functions` env). Client only receives safe `NEXT_PUBLIC_*` values.

### OWASP-aligned controls (implemented)

- A01 Broken Access Control: tenant scoping, role checks, and superadmin-only admin operations.
- A04 Insecure Design: business logic is centralized in services + Functions, not UI components.
- A05 Security Misconfiguration: restrictive Firestore rules for sensitive collections and transitions.
- A07 Identification and Authentication Failures: Firebase Auth token-based user identity required for protected operations.
- A08 Software and Data Integrity Failures: transactional writes and idempotent treasury/earnings markers.
- A09 Security Logging and Monitoring Failures: function-side logs and audit/event tracking on critical flows.

## Latest implementation progress (30 April 2026)

### Bot Hero Monetization Feature — full delivery

A new monetization stream where coaches pay credits to become the face of the bot widget for a defined period.

**Key patterns to know:**

- `src/services/botHero.service.ts` — all Firestore access for packages and requests
- `src/types/botHero.ts` — `BotHeroPackageRecord` (has `imageUrl`/`imagePath`), `BotHeroRequestRecord`, `BotHeroRequestStatus`
- Image upload uses Firebase Storage at path `botHeroPackages/{packageId}/image.{ext}` via `uploadBotHeroPackageImage()`
- Queries use single-equality `where` + client-side sort — no composite index dependency at query time
- Firestore composite indexes deployed but may take minutes to build; queries are robust to index-building state
- Bot widget reads active hero at init; falls back to tenant config gracefully
- Profile picture guard: `profilePhotoUrl` field on `UserProfileRecord` (not `avatarUrl`)
- Admin UI classes: use `styles.button`, `styles.ghostButton`, `styles.programGrid`, `styles.programTile`, `styles.modal`, `styles.modalHeader`, `styles.modalCloseButton` from `SuperAdminPortal.module.css`
- Route wrapper pages use `referralStyles.toolbar` from `ManageReferralsPage.module.css` for the header

**Collections added:**

- `botHeroPackages` — one doc per package, superadmin-managed
- `botHeroRequests` — one doc per coach request, tenant-scoped

**Composite indexes deployed to `studioverse-test`:**

- `botHeroRequests`: `professionalId ASC + createdAt DESC`
- `botHeroRequests`: `status ASC + createdAt ASC`

**Bug fixes made during delivery:**

- `ElevenLabsAgent.tsx`: JSX custom element declaration must use `declare module "react"` not `declare global`
- `getUserProfile` takes `{ userId }` object not plain string
- `UserProfileRecord` uses `profilePhotoUrl` not `avatarUrl`
- `ApproveRequestsPage.tsx`: `operatorId` must be explicitly passed to `<BotHeroRequestsSection>`

### Guest Log Lead Capture — delivered 30 April 2026

- Guest bot conversations stored per `(tenantId + guestPhone)` in `guestLogs` collection
- Bot referral writes moved from client Firestore to `/api/bot/referral` backend route (Admin SDK) — fixes unsigned guest write permission errors
- Firebase Admin credentials required in `.env.local`: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`

## Latest implementation progress (29 April 2026)

### Program/Event/Assessment publish + promotion standardization

- Program, Event, and Assessment admin flows were aligned on explicit `visibility` behavior.
- Publish lifecycle handling was cleaned up so it remains distinct from promotion lifecycle handling.

### Promotion package UX and reliability

- SuperAdmin package flows were aligned for consistent modal-based create/edit behavior.
- Fixed a promotion package create regression where image-upload flows pre-generated IDs that were incorrectly treated as update operations.
- Save logic now checks Firestore doc existence before choosing create vs update.

### Promotion lifecycle rollout across resource types

- Promotion fields standardized across resource models:
  - `promotionPackageId`
  - `promotionStatus` (`none | requested | promoted`)
- Program promotion flow implemented first end-to-end (request -> queue -> approval -> wallet debit -> promotion dates).
- Event promotion flow brought to parity with Program.
- Assessment promotion flow brought to parity with Program/Event.

### Promotion Requests queue consolidation

- SuperAdmin Promotion Requests now supports mixed queues for:
  - Program
  - Event
  - Assessment
- Queue cards display package names and resource labels (not raw IDs).
- Approvals are routed by resource type with consistent wallet and promotion metadata updates.

### Architecture standardization: Assessments now use callable Functions

- Assessments previously saved via direct Firestore writes from admin UI.
- Assessments now use the same callable backend pattern as Program/Event:
  - `functions/src/assessments/assessmentSchemas.ts`
  - `functions/src/assessments/createAssessment.ts`
  - `functions/src/assessments/updateAssessment.ts`
  - exported in `functions/src/index.ts`.
- Frontend assessment definition saves now use service wrapper + callables:
  - `src/services/assessments.service.ts`
  - `src/modules/admin/AssessmentsSection.tsx` migrated off direct metadata writes.

### Build and deployment status

- App build and functions build validated successfully after migration.
- Test rollout completed to Firebase project `studioverse-test`:
  - Program callable updates deployed.
  - Event callable updates deployed.
  - Assessment callable create/update deployed.
- Production deployment intentionally deferred.

## Email setup baseline

For Coaching Studio:

- Verified sending domain: `coachingstudio.in`
- Sender: `contact@coachingstudio.in`
- Resend is used for outbound transactional email
- GoDaddy mailbox is still used for inbox receiving
- DNS records were added in GoDaddy, not Vercel, for the email setup

## How Claude should use this repo

When changing code:

- keep changes minimal and targeted
- preserve existing multi-tenant behavior
- avoid duplicating logic per studio
- ensure production build safety
- preserve developer ergonomics for future studios

## Recommended add-ons

If this repo grows further, add these files:

- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/COACHING_STUDIO.md`
- `docs/TRAINING_STUDIO.md`
- `docs/RECRUITMENT_STUDIO.md`
- `docs/EMAIL_SETUP.md`
- `docs/ROUTING_GUIDE.md`
- `docs/SECURITY_AND_DATA_ACCESS.md`

### Latest implementation progress (29 April 2026) — Earning Packages Admin Refactor

- **Earning Packages (SuperAdmin)**
  - The "Earning Packages" resource page for SuperAdmin was implemented as a first-class admin module, not as a sub-page.
  - The files `ManageEarningPackagesPage.tsx` and its CSS were moved from `src/modules/admin/pages/` to directly under `src/modules/admin/` to match the structure of other admin resource modules.
  - All references and imports were updated to use the new location.
  - The obsolete files and the now-empty `pages` folder were deleted to maintain a clean structure.
  - The SuperAdmin menu now correctly routes to the Earning Packages resource, rendering the real management UI for both Credit and Promotion Packages.
  - The tabbed interface for Credit and Promotion Packages is fully functional and styled consistently with other admin resources.

- **Structural/Architecture Alignment**
  - No business logic or resource pages should be placed in a `pages` folder under admin; all resource modules live directly under `src/modules/admin/`.
  - MenuKey and menu routing are strictly type-checked and aligned with the resource modules.
  - All admin resource pages (including Earning Packages) now follow the same modular, maintainable pattern as other admin features.

- **General Clean-up**
  - Removed all obsolete files and folders after migration.
  - Validated that the admin UI, menu, and routing are consistent and error-free.
