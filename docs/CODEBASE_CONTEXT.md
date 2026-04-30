# StudioVerse — Codebase Context
**Last updated:** April 2026  
**Purpose:** Authoritative implementation snapshot across all epics. Code is source of truth; this document reflects it.

---

## Platform Overview

One codebase, three studio deployments (Coaching, Training, Recruitment), shared app-shell, Firebase backend, Vercel deployment.

**Tech stack:** Next.js 14 App Router · TypeScript strict · Firebase (Auth, Firestore, Functions, Storage) · Groq AI · Resend email · Vercel

**Role model:** `superadmin` · `company` · `professional` · `individual`

**Key folder rules:**
- `src/app/` — routes and layouts
- `src/modules/` — feature UI modules
- `src/services/` — all Firestore/data access
- `src/types/` — shared type definitions
- `src/tenants/` + `src/config/studio.ts` — authenticated studio config
- `functions/` — Firebase Functions (trusted server-side logic)

---

## Epic Implementation Status

### E0 — Marketing Landing Page (~80% complete)

**What is built:**
- `src/modules/landing/pages/LandingPage.tsx` — full multi-section landing with hero, programs carousel, events carousel, tools section, impact counters, auth-aware header
- `src/modules/landing/components/ViewAllHeader.tsx` — sticky nav with login/register for logged-out users, user menu for logged-in
- Multi-tenant support via `src/tenants/` configs (coaching, training, recruitment)
- Promoted-first event ordering on landing

**Gaps:**
- No `generateMetadata()` export for SEO
- No analytics event instrumentation (scroll depth, CTA clicks)
- Chatbot launcher is a placeholder UI (full bot is in E12)
- Benefits section not implemented as distinct cards per role

---

### E1 — App Shell + Route Structure (~70% complete)

**What is built:**
- Full route tree under `src/app/coaching-studio/`, `training-studio/`, `recruitment-studio/` — auth, dashboard, programs, events, tools, manage-*, my-activities, assigned-activities, profile, wallet, referrals
- App-shell placeholder pages in `src/modules/app-shell/`
- Auth state tracked via sessionStorage keys: `cs_uid`, `cs_profile_id`, `cs_role`, `cs_name`, `cs_email`, `cs_phone`
- Mobile-responsive top nav

**Gaps:**
- Dashboard pages are placeholders (no real widgets)
- No Capacitor integration or native app wrapping
- No formal route guard middleware (role-based page access not enforced at route level — only at menu level)

---

### E2 — Program Management (~85% complete)

**What is built:**
- Full type system: `src/types/program.ts` with all enums (delivery types, duration units, ownership scopes, catalog visibility, publication states, statuses)
- `tenantIds: string[]` alongside `tenantId` for multi-tenant publishing; primary tenant immutable after creation
- Firebase Functions: `functions/src/programs/createProgram.ts`, `updateProgram.ts`, `programSchemas.ts` (Zod validation)
- Client service: `src/services/programs.service.ts` — `saveProgram()`, `listPrograms()`, `listScopedPrograms()`
- Admin UI: `src/modules/programs/pages/ManageProgramsPage.tsx`
- Visibility rules: status, publicationState, availableFrom/expiresAt date window
- Audit logging via `functions/src/audit/writeAuditLog.ts`

**Gaps:**
- Promoted flag stored but not surfaced on landing page (unlike Events)
- Thumbnail required-for-publish validation not enforced client-side
- Company/Professional program creation not implemented (foundation exists in schema)

---

### E3 — Event Management (~90% complete)

**What is built:**
- Full type system: `src/types/event.ts` with all enums (event types, statuses including cancelled, ownership scopes, catalog visibility, publication states)
- `tenantIds: string[]` multi-tenant publishing
- Firebase Functions: `functions/src/events/createEvent.ts`, `updateEvent.ts`, `eventSchemas.ts`
- Client service: `src/services/events.service.ts` — `saveEvent()`, `listEvents()`, `listLandingPageEvents()`
- Admin UI: `src/modules/events/pages/ManageEventsPage.tsx`
- Promoted-first ordering on landing page (working)
- Audit logging

**Gaps:**
- Company/Professional event creation not implemented
- Advanced promotion scheduling (future)

---

### E4 — Assessments / Tools Engine (~85% complete)

**What is built:**
- Full type system: `src/types/assessment.ts` — 8 render styles, 10 report style templates
- Report styles: `src/modules/assessments/report-styles.ts` — 10 templates with AI prompts and section structures
- Admin UI: `src/modules/admin/AssessmentsSection.tsx`
- Runtime service: `src/services/assessment-runtime.service.ts` — `getAssessmentLaunchPayload()`, `saveAssessmentCompletion()` (records attempt + triggers AI report generation)
- 6 of 8 quiz runner components implemented: `src/modules/assessments/quiz-runners/` — SingleChoice, InstantFeedbackMultiChoice, GamifiedDragDrop, LikertRatingScale, SliderScale, ForcedTradeoff
- Assessment pages: `src/modules/assessments/pages/AssessmentLaunchPage.tsx`, `AssessmentReportPage.tsx`
- Tools browsing: `src/modules/tools/pages/ToolsPage.tsx`
- Manage Assessments page: `src/modules/assessments/pages/ManageAssessmentsPage.tsx`
- All studio routes: `/*/tools`, `/*/manage-assessments`, `/*/my-activities/assessment-launch/[assignmentId]`, `/*/assessment-report/[assignmentId]`

**Gaps:**
- SelectAndMove and ImageBasedSingleChoice quiz runners — types defined but components not confirmed present
- No AI question generation UI (prompt stored in metadata but no generator)
- No assessment versioning

---

### E5 — Wallet and Coins (~90% complete)

**What is built:**
- Type system: `src/types/wallet.ts` — WalletRecord, WalletTransactionRecord (credit/debit/sent/received/adjustment/reversal/expiry), WalletSummary
- Full service: `src/services/wallet.service.ts` — `createWalletForUser()`, `assignCoins()`, `listWallets()`, `getWalletForUserContext()`, `listWalletTransactionsForUserContext()`, `createCoinRequest()`, `approveCoinRequest()`, `denyCoinRequest()`, `ensureWalletExists()`
- Tenant config: `walletConfig.registrationFreeCoins` (default 10), `walletConfig.referralFreeCoins` (default 5)
- SuperAdmin Manage Wallet UI: `src/modules/admin/ManageCoinsSection.tsx`
- User Wallet page: `src/modules/wallet/pages/ManageWalletPage.tsx`
- Professional coin request: `src/modules/wallet/pages/RequestCoinsPage.tsx`
- Company coin request approval modal: `src/modules/wallet/components/CoinRequestsModal.tsx`
- Registration bonus triggered on profile creation from `src/services/profile.service.ts`
- All studio routes: `/*/manage-wallet`, `/*/request-coins`, `/*/buy-coins`

**Gaps:**
- `/*/buy-coins` route exists but page is minimal
- No admin UI for adjustment/reversal transaction types
- No wallet analytics dashboard

---

### E6 — Profile Management (~85% complete)

**What is built:**
- Full type system: `src/types/profile.ts` — UserProfileRecord with 40+ fields, mandatory vs optional split, role-specific extensions
- Profile service: `src/services/profile.service.ts` — `saveUserProfile()`, `getUserProfile()`, `getUserProfileByPhone()`, mandatory field evaluation, `profileCompletionPercent`, `assignmentEligible` computation
- Profile page: `src/modules/profile/pages/ProfilePage.tsx` — role-specific sections, non-editable identity fields, profile picture upload
- Dashboard profile completion banner
- `assignmentEligible` gates assignment creation when profile incomplete

**Gaps:**
- Profile picture upload UI exists but Firebase Storage integration completeness not confirmed
- No public coach profile (future scope)

---

### E7 — Activity Assignment (~85% complete)

**What is built:**
- Full assignment service: `src/services/assignment.service.ts` — `searchUsersByPhoneOrEmail()`, `createAssignment()`, `createCohortAssignment()`, `createRecommendation()`, `provisionAssigneeIfNeeded()` (auto-provisions not-found users as Individual with wallet)
- Type system: `src/types/assignment.ts` — AssignmentRecord with statuses (assigned/registered/recommended/in_progress/completed/cancelled), ActivityType (program/event/assessment)
- AssignmentModal: `src/modules/activities/components/AssignmentModal.tsx` — search, found, not-found, wallet confirm, cohort toggle, self-assign flows
- MyActivitiesPage: `src/modules/activities/pages/MyActivitiesPage.tsx`
- AssignedActivitiesPage: `src/modules/activities/pages/AssignedActivitiesPage.tsx`
- Assignment email: `src/services/mail.service.ts` `sendAssignmentEmail()`
- All studio routes for my-activities, assigned-activities

**Gaps:**
- "Register Now" / "Try Now" self-assignment buttons on activity detail pages need verification
- `isSelfAssignment` and `searchMatchedRegisteredUser` flags from E7 spec not confirmed in AssignmentRecord type
- Wallet deduction on cohort assignment scales correctly (members × cost)

---

### E8 — Role-Based Access Control (~70% complete)

**What is built:**
- Menu config (primary): `src/modules/activities/config/menuConfig.ts` — grouped menu structure (my-account, manage, actions) with role-based visibility for company, professional, individual
- Menu config (older): `src/modules/coaching-studio/menuConfig.ts` — flat structure, overlaps with above
- `getRoleMenuItems()`, `getRoleMenuGroups()`, `getRoleLabel()` utility functions
- My Activities: visible for company/professional/individual, NOT for superadmin
- Manage Assessments: visible for company/professional (tenant-scoped view — intentional divergence from E8 matrix which says superadmin only)
- References (manage-referrals): visible for company/professional
- Assigned Activities: visible for company/professional

**Gaps:**
- Super Admin is NOT in activities menu config — handled separately via SuperAdminPortal
- No route-level authorization guards (users can bypass menu by direct URL)
- `assign-activity` menu item (Company + Professional) links to `/dashboard` — assignment is modal-based and has no dedicated route yet
- Sign Out action missing from menu config
- Two separate menu configs exist — should be consolidated
- Backend enforcement (defense in depth) not visible

---

### E9 — Cohort Management (~80% complete)

**What is built:**
- Type system: `src/types/cohort.ts` — CohortRecord, CohortMemberRecord, CohortListItem, CohortMemberUser, SaveCohortInput, CohortDetail, CohortAssignmentPayload; status: draft/inactive/active
- Full service: `src/services/cohorts.service.ts` — `saveCohort()`, `getCohortDetail()`, `listCohortsForScope()`, `searchIndividualsForCohort()`, `listProfessionalsForCohortScope()`, `getCohortAssignmentPayload()`, `computeStatus()`, `resolveNewIndividuals()`
- Status logic: active if memberCount >= 2 AND professionalId exists; inactive otherwise
- Cohort management UI: `src/modules/cohorts/pages/ManageCohortsPage.tsx`
- All studio routes: `/*/manage-cohorts`
- Cohort assignment integration in `createCohortAssignment()` — scales coin cost by member count, atomic transaction

**Gaps:**
- Professional back-association on later assignment (when Company adds Professional to existing cohort, all cohort Individuals should be associated) — not confirmed
- Member removal from cohort not confirmed in service
- Minimum 2-member validation not enforced at service level (only at status level)

---

### E10 — Scoped User Management (~95% complete)

**What is built:**
- Full service: `src/services/manage-users.service.ts` — `createScopedManagedUser()` (Company creates Professional/Individual, Professional creates Individual), role validation, tenant inheritance, coach association, wallet initialization
- Exception rule: Company→Professional creation receives 0 coins; all other new users receive `registrationFreeCoins`
- `listProfessionalsForCoachDropdown()` — scoped professional lookup for coach assignment
- UI: `src/modules/users/pages/ManageUsersPage.tsx`
- All studio routes: `/*/manage-users`

**Note:** `/src/app/api/users/create-scoped/route.ts` is fully implemented (verified April 2026). Handles auth token verification, role guards, phone deduplication, atomic wallet creation, and auth user rollback on Firestore failure.

---

### E11 — Referrals (~100% complete)

**What is built:**
- Full service: `src/services/referral.service.ts` — `createReferral()`, `listReferralsForUser()`, `listAllReferrals()` (with role/type/status/tenantId filters), `sendReferralReminders()`, `processReferralJoinForNewUser()`
- Referral type: `src/types/referral.ts`
- Status values: `referred` → `reminded` → `joined`
- Join reward: tenant-configured `walletConfig.referralFreeCoins` (default 5); creation-time reward intentionally NOT implemented
- Deduplication: only credits join reward, no duplicate onboarding transactions
- Tenant filter on `listAllReferrals` (added April 2026)
- User-facing manage referrals: `src/modules/referrals/pages/ManageReferralsPage.tsx`
- SuperAdmin referrals with tenant dropdown: `src/modules/admin/SuperAdminPortal.tsx` (referrals section)
- Mail placeholders: `sendReferralInviteEmail()`, `sendReferralReminderEmail()` in `src/services/mail.service.ts`
- Menu entry "References" in all role menus (`menuConfig.ts`)
- All studio routes: `/*/manage-referrals`
- Referral join processed from both auth flows: `LoginRegisterModal.tsx` and `AuthWizard.tsx`

**Notes:**
- Creation-time 10-coin reward is documented as intentionally deferred (not a bug)
- `tenantId` stored on each referral record; SuperAdmin tenant dropdown filters live

---

### E12 — Tenant AI Bot (~98% complete)

**What is built:**
- BotWidget: `src/modules/bot/BotWidget.tsx` — floating launcher, mode selector (Studio Bot / Professional Bot), guest onboarding (name + phone), message cap enforcement, post-cap email capture for guests
- Chat API: `src/app/api/bot/chat/route.ts` — Groq `llama-3.3-70b-versatile`, 6-turn history, Studio mode (context-grounded) + Professional mode (domain expert)
- Retrieval API: `src/app/api/bot/retrieve/route.ts` — TF-IDF keyword scoring against knowledge base chunks
- Knowledge build script: `scripts/build-bot-knowledge.mjs` — processes E0–E11 + exec doc → `public/bot-knowledge/coaching-studio.json`
- Groq utility: `src/lib/ai/groq.ts`
- Tenant botConfig type: `src/types/tenant.ts` — visible, studioBotEnabled, professionalBotEnabled, personaName, personaAvatar, messageCap
- Coaching Studio config: persona "Coach Dinesh", messageCap 5, both modes enabled
- Auto-referral creation for bot guests (referrer = oldest SuperAdmin)
- BotWidget mounted in all three studio layouts

**Gaps:**
- No rate limiting on `/api/bot/*` endpoints
- No explicit "bot-source" marker on referrals created by bot guests
- Knowledge base is re-loaded per request (no persistent cache)

---

## Registration Flow Summary

Two auth implementations exist:

### 1. `AuthWizard.tsx` (`src/modules/auth/components/AuthWizard.tsx`)
Used via `AuthPage.tsx` on all studio `/auth` routes. **5 phases:** phone → otp → role-select → details → done.
- Uses Firebase Phone Auth with visible reCAPTCHA v2
- Details phase for **company**: Company Name → Role (Owner/Professional radio) → Full Name → Email
- Details phase for **professional**: Full Name → Email
- Details phase for **individual**: Full Name → Email
- Validation: name required, email regex, company name required for company
- Calls `saveUserProfile()` → triggers wallet creation + referral join processing

### 2. `LoginRegisterModal.tsx` (`src/modules/auth/components/LoginRegisterModal.tsx`)
Embedded modal, used as an alternative login/register flow. **5 phases:** login-phone → login-otp → register-role → register-details → success.
- Uses invisible reCAPTCHA
- "User not found" after OTP → offers Register
- Details phase (April 2026 update): **company**: Company Name → Full Name → Email → Position; **professional/individual**: Full Name → Email
- Writes directly to Firestore (does not call `saveUserProfile()`) — uses `setDoc` with `merge: true`
- Email now validated client-side (regex) and stored in Firestore + session storage

**Important difference:** `LoginRegisterModal` writes raw user doc directly to Firestore; `AuthWizard` uses `saveUserProfile()` service which handles profile completion scoring, wallet creation, and full user record structure. If both paths are in use, LoginRegisterModal-registered users may have incomplete profile records.

---

## SuperAdmin Portal

Single component: `src/modules/admin/SuperAdminPortal.tsx`

**Sections (menu keys):**
- `dashboard` — stats tiles (users, tenants, programs, assessments, events, coins, referrals made/joined)
- `users` — list all users, create/edit users, filter by type
- `tenants` — list tenants, create/edit tenants (with landingConfig, walletConfig, mailConfig, botConfig)
- `tools` → `AssessmentsSection` — create/edit assessments, question banks
- `programs` → `ProgramsSection` — create/edit programs, multi-tenant publish
- `events` → `EventsSection` — create/edit events, multi-tenant publish
- `coins` → `ManageCoinsSection` — issue coins, view wallet summaries
- `referrals` — view all referrals, filter by tenant/role/type/status, send reminders

**Tenant dropdown on referrals:** Added April 2026. Loads tenants via `loadTenants()` when referrals menu activates. Passes `tenantId` to `listAllReferrals()`.

---

## Known Critical Issues

| # | Epic | Issue | File |
|---|------|-------|------|
| 1 | E10 | `/api/users/create-scoped/route.ts` missing — scoped user creation cannot be triggered from frontend | Directory: `src/app/api/users/create-scoped/` |
| 2 | E8 | No route-level authorization guards — direct URL access bypasses menu-level role hiding | All page components |
| 3 | E8 | Two separate menu configs — `activities/config/menuConfig.ts` vs `coaching-studio/menuConfig.ts` — should consolidate | Both files |
| 4 | E1 | `LoginRegisterModal` does not call `saveUserProfile()` — registered users may have incomplete profile records | `src/modules/auth/components/LoginRegisterModal.tsx` |
| 5 | E8 | `manage-cohort` and `manage-individual` menu links point to `/dashboard` — not wired to real routes | `menuConfig.ts` |

---

## Services Quick Reference

| Service | File | Key Functions |
|---------|------|---------------|
| Profile | `src/services/profile.service.ts` | `saveUserProfile`, `getUserProfile`, `getUserProfileByPhone` |
| Programs | `src/services/programs.service.ts` | `saveProgram`, `listPrograms`, `listScopedPrograms` |
| Programs (scoped) | `src/services/programs-scoped.service.ts` | Company/Professional scoped program management |
| Events | `src/services/events.service.ts` | `saveEvent`, `listEvents`, `listLandingPageEvents` |
| Events (scoped) | `src/services/events-scoped.service.ts` | Scoped event management |
| Assessments | `src/services/assessment-runtime.service.ts` | `getAssessmentLaunchPayload`, `saveAssessmentCompletion` |
| Assessments (scoped) | `src/services/assessments-scoped.service.ts` | Scoped assessment management |
| Assignment | `src/services/assignment.service.ts` | `createAssignment`, `createCohortAssignment`, `createRecommendation`, `provisionAssigneeIfNeeded` |
| Cohorts | `src/services/cohorts.service.ts` | `saveCohort`, `getCohortDetail`, `listCohortsForScope`, `getCohortAssignmentPayload` |
| Wallet | `src/services/wallet.service.ts` | `createWalletForUser`, `assignCoins`, `ensureWalletExists`, `createCoinRequest`, `approveCoinRequest` |
| Referrals | `src/services/referral.service.ts` | `createReferral`, `listAllReferrals`, `processReferralJoinForNewUser`, `sendReferralReminders` |
| Manage Users | `src/services/manage-users.service.ts` | `createScopedManagedUser`, `listProfessionalsForCoachDropdown` |
| Mail | `src/services/mail.service.ts` | `sendAssignmentEmail`, `sendReferralInviteEmail`, `sendReferralReminderEmail` |

---

## Multi-Tenant Content Sharing Pattern (E2, E3)

Programs and Events both support:
```
tenantId: string     // primary/owning tenant — immutable after creation
tenantIds: string[]  // additional tenants — editable
```

Visibility rule (implemented in service layer):
```typescript
item.tenantId === targetTenant || item.tenantIds?.includes(targetTenant)
```

SuperAdmin UI uses checkbox multi-select with primary tenant locked during edit.

---

## Wallet Coin Rules Summary

| Event | Coins | Source |
|-------|-------|--------|
| Self-registration (Professional/Individual) | `walletConfig.registrationFreeCoins` (default 10) | Tenant config |
| Company creates Professional/Individual | 0 coins | Hard-coded exception |
| Referral join | `walletConfig.referralFreeCoins` (default 5) | Tenant config |
| Referral creation | 0 (not implemented) | Intentionally deferred |
| Activity assignment | -`creditsRequired` | Activity field |
| SuperAdmin manual issuance | Configurable | Admin action |

---

## Email Infrastructure

- Provider: Resend
- Verified domain: `coachingstudio.in` (coaching studio)
- Sending subdomain: `send.coachingstudio.in`
- GoDaddy mailbox `@` records must remain intact
- `RESEND_API_KEY` required in Vercel environment variables
- All send functions in `src/services/mail.service.ts`
- Tenant mail enabled/disabled via `mailConfig.enabled` flag in tenant doc
