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

This context file should not try to reproduce every implementation detail. Those details belong in the deeper domain docs and feature docs.

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