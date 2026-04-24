# StudioVerse — Outstanding Work
**Last updated:** April 2026  
**Source:** Full codebase audit against E0–E12 epics. See `docs/CODEBASE_CONTEXT.md` for full context.

---

## Critical (Blockers)

### E10 — Missing API Route for Scoped User Creation
- `/src/app/api/users/create-scoped/route.ts` does not exist
- Directory exists but has no `route.ts` file
- Without this, Company and Professional cannot create managed users from the UI
- Service layer (`src/services/manage-users.service.ts`) is complete and ready

### E1 — LoginRegisterModal Does Not Use `saveUserProfile()`
- `src/modules/auth/components/LoginRegisterModal.tsx` writes a raw user doc directly to Firestore via `setDoc` with `merge: true`
- `src/modules/auth/components/AuthWizard.tsx` correctly calls `saveUserProfile()` which handles profile completion scoring, wallet creation, and full record structure
- Users who register via the modal get an incomplete profile record (missing `mandatoryProfileCompleted`, `profileCompletionPercent`, `assignmentEligible`, etc.)
- Fix: Refactor `LoginRegisterModal.handleRegister()` to call `saveUserProfile()` instead of writing directly to Firestore

---

## High Priority

### E8 — No Route-Level Authorization Guards
- Menu hiding is implemented but users can bypass it with a direct URL
- No auth middleware or role checks at the page component level
- All page components under `src/app/*/` need a role guard before rendering content
- Required for "defense in depth" per E8 section 16

### E8 — Two Duplicate Menu Configs
- `src/modules/activities/config/menuConfig.ts` — grouped structure, primary/current
- `src/modules/coaching-studio/menuConfig.ts` — older flat structure, overlaps with above
- Should consolidate to a single source of truth
- Risk: Changes made to one are not reflected in the other

### E8 — Manage Cohort and Manage Individual Menu Links Broken
- Both `manage-cohort` and `manage-individual` menu items currently link to `/dashboard` (placeholder)
- Should link to `/manage-cohorts` and `/manage-users` respectively
- Affects both menu config files

### E8 — Sign Out Action Missing from Menu Config
- No `sign-out` menu item in any role in `src/modules/activities/config/menuConfig.ts`
- E8 snapshot states all role menus include Sign Out in the Actions group

### E8 — Super Admin Not in Unified Menu System
- Super Admin is handled by a separate portal (`src/modules/admin/SuperAdminPortal.tsx`) and is not a valid role in the activities menu config
- Creates two separate navigation paradigms
- Decision needed: keep SuperAdminPortal as standalone or integrate into unified menu system

---

## Medium Priority

### E2 — Promoted Programs Not Surfaced on Landing Page
- `promoted` flag is stored and editable on programs
- Events correctly surface promoted items first on the landing page (`listLandingPageEvents`)
- Programs do not have equivalent promoted-first landing page display
- Fix: Add `listLandingPagePrograms()` equivalent in `src/services/programs.service.ts` with promoted-first ordering, and wire into `LandingPage.tsx`

### E2 / E3 — Thumbnail Required-for-Publish Not Enforced Client-Side
- Spec states thumbnail is recommended for draft, required for publish
- No client-side validation prevents publishing without a thumbnail
- Should add a check in program/event save handler before calling Firebase Function

### E4 — SelectAndMove and ImageBasedSingleChoice Quiz Runners Unconfirmed
- Types for both render styles are defined in `src/types/assessment.ts`
- Components not confirmed present in `src/modules/assessments/quiz-runners/`
- Verify or implement: `SelectAndMoveQuiz.tsx`, `ImageBasedSingleChoiceQuiz.tsx`

### E4 — No AI Question Generation UI
- `aiGenerationPrompt` field is stored in assessment metadata
- No UI or service to trigger AI generation of questions from this prompt
- Would allow SuperAdmin to auto-populate question banks

### E5 — Buy Coins Page is Minimal
- Route `/*/buy-coins` exists across all studios
- Page implementation is a placeholder
- Needs real functionality (payment integration or coin purchase flow)

### E5 — No Admin UI for Wallet Adjustments and Reversals
- Transaction types `adjustment_credit`, `adjustment_debit`, `reversal`, `expiry` exist in the type system
- No admin UI to create these transaction types
- SuperAdmin cannot currently correct wallet errors

### E9 — Member Removal from Cohort Not Confirmed
- `saveCohort()` in `src/services/cohorts.service.ts` handles adding members
- No clear removal path found in service or UI
- Need to verify `ManageCohortsPage.tsx` supports removing existing members

### E9 — Professional Back-Association on Later Assignment Not Confirmed
- E9 spec: when a Company later assigns a Professional to an existing cohort, all cohort Individuals should become associated with that Professional
- `saveCohort()` service function exists but back-association logic not confirmed present
- Needs verification and implementation if missing

### E9 — Minimum 2-Member Cohort Not Validated at Save
- `computeStatus()` requires memberCount >= 2 for active status
- No validation preventing save of a cohort with fewer than 2 members
- A cohort can be saved in an indefinite inactive state
- Consider adding a warning or block at the UI level

### E7 — Register Now / Try Now Buttons on Activity Detail Pages
- `AssignmentModal` supports a `selfAssign` prop that skips search and goes straight to confirm
- Not confirmed that "Register Now" / "Try Now" buttons are wired on Programs, Events, and Assessments detail pages
- Needs verification across all three activity types

---

## Low Priority / Polish

### E0 — SEO Metadata Missing
- No `generateMetadata()` export visible in `src/modules/landing/pages/LandingPage.tsx`
- Add Next.js metadata exports (title, description, Open Graph) for each studio's landing page

### E0 — Analytics Event Instrumentation
- No analytics events tracked (scroll depth, CTA clicks, role selection, auth funnel)
- Spec requires one analytics provider with 8+ event types
- Choose a provider and add instrumentation

### E0 — Benefits Section Not Implemented
- Hero, programs, events, tools sections are live
- Benefits/why-choose-us section not implemented as distinct cards per role (Coach vs Learner)

### E1 — Dashboard Has No Real Widgets
- Dashboard pages are placeholders across all studios and roles
- Needs role-appropriate widgets: upcoming activities, wallet balance, referral count, profile completion

### E4 — Assessment Versioning
- No version control when an assessment's questions are updated
- Existing reports reference the question set at time of attempt — this could become inconsistent
- Consider snapshotting questions at attempt time or adding a version field

### E5 — Wallet Analytics
- No utilization rate calculation or reconciliation view
- Would help SuperAdmin understand platform coin circulation

### E12 — Bot API Rate Limiting
- `/api/bot/chat` and `/api/bot/retrieve` have no rate limiting
- Vulnerable to abuse or excessive Groq API costs
- Add rate limiting middleware (e.g., per-IP, per-session)

### E12 — Bot Knowledge Base Not Cached
- Knowledge base JSON is loaded on every retrieval request
- Should be cached in memory at module level (or using Next.js `unstable_cache`) to avoid file I/O on every chat message

### E12 — No Bot-Source Marker on Guest Referrals
- Referrals created by the bot widget during guest onboarding have no distinguishing field
- Makes it impossible to filter or report on bot-originated referrals vs manually created ones
- Add a `source: "bot"` field to referral records created from `BotWidget.tsx`
