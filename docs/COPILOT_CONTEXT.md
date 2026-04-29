# Copilot Context — StudioVerse

<!-- markdownlint-disable MD013 -->

Status: Working instruction file for AI-assisted code generation in this repository.  
Read this before generating or modifying code.

## Latest implementation progress (29 April 2026) — Program/Event/Assessment Publish + Promotion Standardization

### Cross-entity publishing model cleanup

- Program, Event, and Assessment admin flows were aligned to use explicit `visibility: public|private` behavior.
- Legacy semantic overlap between `Publish` and `Active` was cleaned up in admin handling and save normalization.
- Publish now controls catalog availability behavior consistently; promotion remains a separate lifecycle.

### Credit Packages and Promotion Packages admin UX alignment

- SuperAdmin package terminology and flows were aligned to `Credit Packages` / `Promotion Packages` where applicable.
- Add-package interactions were normalized to modal-based behavior consistent with other admin create forms.
- Promotion package create flow regression was fixed:
  - root cause: newly generated IDs with image upload were incorrectly treated as update operations.
  - fix: package save now checks Firestore document existence before deciding create vs update.

### Promotion workflow implementation (Program -> Event -> Assessment)

- Introduced/standardized promotion request fields:
  - `promotionPackageId`
  - `promotionStatus` (`none | requested | promoted`)
  - request/approval metadata and applied package details persisted on approval.
- Program promotion lifecycle implemented first end-to-end:
  - request from resource form
  - superadmin queue visibility
  - approval workflow
  - wallet debit transaction on approval
  - promotion start/end date stamping.
- Event promotion lifecycle implemented with parity to Program:
  - same request + queue + approval + wallet deduction model.
- Assessment promotion lifecycle then implemented with parity:
  - request controls in Manage Assessments
  - package selection and wallet precheck
  - queue visibility and approval support.

### Promotion Requests queue consolidation

- SuperAdmin Promotion Requests now supports mixed resource queues:
  - Program
  - Event
  - Assessment
- Queue cards show package name and resource type labels (not raw IDs).
- Approval handlers route by resource type while applying identical wallet + promotion bookkeeping rules.

### Backend standardization: Assessments moved to callable Functions

- Assessments previously used direct client-side Firestore writes from admin UI.
- Assessments now follow the same architecture as Program/Event via callable Functions:
  - new function schema + validation: `functions/src/assessments/assessmentSchemas.ts`
  - new callable create: `functions/src/assessments/createAssessment.ts`
  - new callable update: `functions/src/assessments/updateAssessment.ts`
  - exported in `functions/src/index.ts`.
- Frontend now uses service wrapper + callables for assessment definition saves:
  - `src/services/assessments.service.ts`
  - `src/modules/admin/AssessmentsSection.tsx` migrated off direct `updateDoc`/`writeBatch` metadata writes.
- App and functions builds validated successfully after migration.

### Test-project deployment status

- Program callable updates deployed to `studioverse-test` during rollout.
- Event callable updates deployed to `studioverse-test` during rollout.
- New Assessment callables (`createAssessment`, `updateAssessment`) deployed to `studioverse-test`.
- Production deploy intentionally deferred.

## Latest implementation progress (23 April 2026) — Referral Join Coin Deduplication

- Fixed referral-join reward logic to prevent double onboarding credits for referred users.
- `processReferralJoinForNewUser` now:
  - marks referral status as `joined`
  - credits only the referrer with `referralFreeCoins`
  - no longer credits an additional "referred user registration" transaction
- Rationale:
  - onboarding/registration coins are already granted in the registration flow
  - referral join should not duplicate that issuance for the same registration event

## Latest implementation progress (23 April 2026) — Company-Created Coach Wallet Rule

- Updated scoped user creation logic so when a Company creates a Coach (`targetUserType=professional`):
  - coach wallet is created
  - initial wallet coins are set to `0`
  - no initial wallet credit transaction is written
- Other user-creation paths retain tenant-configured onboarding credits.

## Latest implementation progress (23 April 2026) — Assignment Provisioned User Wallet Bonus

- Updated assignment-time "not found" assignee provisioning flow:
  - when a new Individual is auto-created from assignment/recommendation flow, wallet creation now uses tenant onboarding bonus (`walletConfig.registrationFreeCoins`)
  - onboarding credit transaction is written via shared `createWalletForUser` logic
- This replaces the previous zero-balance wallet initialization for assignment-provisioned users.

## Latest implementation progress (23 April 2026) — SuperAdmin User Creation Wallet Issuance

- Updated SuperAdmin user-creation flow so new `company`, `professional`, and `individual` users now:
  - get a wallet document created at user creation time
  - receive tenant onboarding coins (`walletConfig.registrationFreeCoins`)
  - receive an initial wallet credit transaction (`Initial wallet issuance`)
- `superadmin` user type remains non-wallet-bearing.

## Latest implementation progress (21 April 2026) — Wallet Completion + Coaching Bot Rollout

### Epic E5 (Manage Wallet) — Current state aligned to implementation

- SuperAdmin Manage Wallet UI now follows a two-panel layout (like Manage Users):
  - left panel: assignment controls
  - right panel: wallet list and filters
- Wallet list filtering is active for `All`, `Company`, `Professional`, and `Individual`.
- Manual "Add Wallet" action was removed from SuperAdmin Manage Wallet.
- Wallets are now expected to be created automatically during onboarding/registration paths.
- Runtime bug fixed in admin wallet module: removed stale state setter reference in `ManageCoinsSection`.

### Registration wallet bonus fix (tenant-configured)

- New user registration now applies tenant-configured `walletConfig.registrationFreeCoins` (default fallback: 10).
- Registration wallet creation now writes both:
  - initialized wallet balances (`totalIssuedCoins`, `availableCoins`)
  - wallet ledger credit transaction with reason `Registration bonus`
- Applied across active signup/profile onboarding paths to ensure behavior consistency.

### Coin request lifecycle remains active and enforced

- Professional request flow: `/<tenant>/request-coins`
- Company approval/denial flow: Manage Wallet pending badge + modal
- Firestore rules continue to enforce role-scoped transitions (`pending` -> `approved`/`denied`)

### Coaching Studio Bot (E12) implementation delivered

- Tenant-configurable bot added with dual operation modes:
  - Studio Bot (tenant knowledge-grounded)
  - Professional Bot (coach-style guidance)
- Open-ended mode detection implemented in chat UX (no forced mode buttons).
- Guest capture flow implemented (name + phone + email at cap), referral record creation integrated.
- Message cap flow implemented (current limit: 5 messages).
- Bot management controls added in tenant admin (`visible`, mode toggles, persona name, message cap).
- Groq integration moved to shared utility path and active production model updated to `llama-3.3-70b-versatile`.
- Bot UI refreshed with blue visual language and circular launcher ring style.

### Bot knowledge base quality improvements

- Knowledge build pipeline reworked to generate structured chunks directly from epic docs.
- Source scope constrained to `docs/E0.md` through `docs/E11.md` only.
- Current output generated successfully: 693 structured chunks.
- Internal artifact references and noisy identifiers were stripped for cleaner retrieval context.
- Retrieval service updated to score against `epicId`, `epicTitle`, `sectionTitle`, and body text.

### Documentation updates completed

- `docs/E12.md` created/expanded as implementation-grade bot epic spec with checklist tracking.
- `docs/E5.md` updated to reflect actual shipped behavior (Manage Wallet naming, coin-request lifecycle, tenant registration bonus, and current DoD/QA expectations).

## Latest implementation progress (19 April 2026) — Multi-Tenant Content Sharing

**Major feature: Programs/Events/Assessments can now be published to multiple tenants from superadmin portal.**

### Data Model Changes

- Added `tenantIds: string[]` field to `ProgramRecord`, `EventRecord`, `AssessmentRecord` (alongside retained `tenantId` for backward compatibility)
- `ProgramFormValues`, `EventFormValues`, `AssessmentFormValues` now include `tenantIds: string[]`
- Validation schemas enforce at least one tenant selection
- Tenant visibility determined by: `item.tenantId === targetTenant || item.tenantIds.includes(targetTenant)`

### Admin Portal UI

- Program/Event tenant selector changed from single `<select>` to **checkbox multi-select**
- Assessment tenant management updated to interactive multi-select
- During **create**: all tenant checkboxes are editable
- During **edit**:
  - Primary tenant is disabled and shows **"Primary (locked)"** badge
  - Other tenants remain editable (add/remove secondary tenants)
  - Primary tenant preservation prevents backend immutable field violations
- New CSS class: `.primaryLockBadge` in `SuperAdminPortal.module.css`

### Backend Function Updates

- `programSchemas.ts`, `eventSchemas.ts`: accept and validate `tenantIds`
- `createProgram.ts`, `createEvent.ts`: write `tenantIds` to Firestore
- `updateProgram.ts`, `updateEvent.ts`: immutable checks preserve primary tenant; allow secondary tenant updates
- Audit logs capture tenant scope changes

### Service Layer

- `programs.service.ts`, `events.service.ts`, `assessment.service.ts`:
  - Send/read/filter by tenant scope using helper logic
  - List filtering matches `tenantId` OR inclusion in `tenantIds`
  - All assignments and admin operations use updated scope matching

### Tenant-Facing Pages Updated

- **Shared modules:** `ProgramsPage`, `EventsPage`, `ToolsPage` (in `src/modules/`)
- **Coaching Studio:** `CoachingProgramsPage`, `CoachingEventsPage`, `CoachingToolsPage`
- **Landing pages:** `LandingPage`, `CoachingLandingPage`
- All use tenant-scope helper: `normalizeTenantToken(item.tenantId) === targetTenant || (item.tenantIds?.includes(targetTenant) ?? false)`

### Bug Fixes & Stability (This Session)

- Fixed assignment phone search regression: normalized E.164 format + tenant-scoped matching in `assignment.service.ts`
- Restored dashboard profile-incomplete warning banner in `DashboardPage.tsx`
- Removed tracked `firebase-debug.log` exposing Groq API key; unblocked push
- Fixed auth modal reCAPTCHA null-style crash: persistent DOM node lifecycle in `LoginRegisterModal.tsx`
- Fixed tenant role labels (Professional/Individual → Coach/Coachee for Coaching Studio)

### Build Status

✅ Full compile passes (`npm run build` 19 April 2026)  
✅ Zero TypeScript errors  
✅ All modified files validated

---

## Previous implementation progress (16 April 2026)

- Epic E10 user-management scope is now expanded beyond SuperAdmin:
  - SuperAdmin: can create `company`, `professional`, and `individual` users (existing behavior retained).
  - Company: can create `professional` and `individual` users; created users are associated to the same tenant/company context.
  - Professional: can create `individual` users; created individuals are associated to the creating professional.
- New scoped user-creation backend endpoint is active: `src/app/api/users/create-scoped/route.ts`.
- Tenant routes for role-scoped user management are active under each studio:
  - `/<tenant>/manage-users` for coaching, training, and recruitment studios.
- Assessment report system now supports style-aware structures (not just fixed generic buckets):
  - 10 report styles with style-specific section contracts.
  - API response includes structured sections aligned to selected report style.
  - Report page renders style-specific sections dynamically with legacy fallback support.
- User dropdown menu redesign is implemented platform-wide:
  - Three non-clickable group headers: `My Account`, `Manage`, `Actions`.
  - Group labels are visually distinct and premium-styled.
  - Redundant `Manage` prefixes removed from item labels within `Manage` group.
  - Dropdown width and spacing were tightened for denser, cleaner layout.
  - Mobile outside-tap close behavior reinforced via pointer/touch/mouse listeners in `src/hooks/useClickOutside.ts`.
- Recent production build validations complete successfully with new routes and pages compiling.

## Refactor progress update (16 April 2026)

**Recent addition (16 April 2026):**

- Implemented style-aware assessment reporting system
- 10 predefined report-style templates (Development, Diagnostic, Capability Scorecard, Leadership Readiness, Behavioral Pattern, 360 Influence, Growth Journey, Executive Coaching Premium, Action-Centric, Psychological Insight)
- Report processing now returns style-specific sections instead of generic buckets
- Report rendering dynamically displays sections based on selected style
- Backward compatible with legacy reports using fixed four-bucket schema

**Refactor objective (ongoing):**

- move shared app-shell implementations out of `src/modules/coaching-studio/` into neutral shared module folders
- keep tenant routes as thin wrappers
- preserve one privacy policy page per tenant (left as-is by decision)

Completed phases:

- Phase 1: Activities
  - moved My Activities + Assigned Activities into `src/modules/activities/`
  - moved shared detail/assignment modal components into `src/modules/activities/components/`
  - moved shared menu config into `src/modules/activities/config/menuConfig.ts`
  - updated `src/modules/app-shell/MyActivitiesPage.tsx` and `src/modules/app-shell/AssignedActivitiesPage.tsx`
- Phase 2: Profile
  - moved profile page implementation into `src/modules/profile/pages/ProfilePage.tsx`
  - updated `src/modules/app-shell/ProfilePage.tsx`
- Phase 3: Programs
  - moved programs page implementation into `src/modules/programs/pages/ProgramsPage.tsx`
  - updated `src/modules/app-shell/ProgramsPage.tsx`
- Phase 4: Events
  - moved events page implementation into `src/modules/events/pages/EventsPage.tsx`
  - updated `src/modules/app-shell/EventsPage.tsx`
- Phase 5: Tools
  - moved tools page implementation into `src/modules/tools/pages/ToolsPage.tsx`
  - updated `src/modules/app-shell/ToolsPage.tsx`
- Phase 6: Wallet
  - moved wallet page implementation into `src/modules/wallet/pages/ManageWalletPage.tsx`
  - updated `src/modules/app-shell/ManageWalletPage.tsx`
- Phase 7: Landing
  - copied landing page + carousel hook into `src/modules/landing/`
  - app-shell import switched to `src/modules/landing/pages/LandingPage.tsx`
  - moved shared view-all header into `src/modules/landing/components/ViewAllHeader.tsx`
  - rewired programs/events/tools/activities/profile/wallet modules to use landing-owned styles/components
  - completed with successful production build validation
- Phase 8: Auth
  - auth components are now in `src/modules/auth/components/`
  - `src/modules/app-shell/AuthPage.tsx` uses `@/modules/auth/components/AuthWizard`
- Phase 9: Dashboard
  - dashboard page is now in `src/modules/dashboard/pages/DashboardPage.tsx`
  - `src/modules/app-shell/DashboardPage.tsx` uses `@/modules/dashboard/pages/DashboardPage`

### Epic E5 (Manage Wallet) — Coin Request Lifecycle (Completed 19 April 2026)

**US-E5-08 — Professional Can Request Coins from Associated Company** ✅

- Request Coins page accessible at `/<tenant>/request-coins` for all studios
- Professional submits quantity-based coin requests scoped to their associated Company
- Requests stored in Firestore with `requesterProfessionalId` + `companyId` for accurate routing
- Implementation: `RequestCoinsPage.tsx` with form validation and Firestore write

**US-E5-09 — Company Can Approve or Deny Coin Requests with Ruleset Enforcement** ✅

- Manage Wallet page displays pending coin request count as live badge
- Company users access coin requests modal to view, approve, or deny pending requests
- Approve transitions status to "approved" and issues coins to Professional's wallet via ledger transaction
- Deny transitions status to "denied" with optional reason persistence
- Firestore rules restrict approve/deny to Company users only
- Badge count refreshes in real-time after approval/denial actions
- Implementation: `CoinRequestsModal.tsx` with approve/deny logic integrated into `ManageWalletPage.tsx`

### Firestore Security Rules — Coin Request Lifecycle

- Helper functions: `isCompanyUser()`, `isProfessionalUser()` determine access rights
- `match /coinRequests/{requestId}`:
  - `allow create`: Professional users with `requesterProfessionalId == auth.uid` and `status == "pending"`
  - `allow read`: Professionals see own requests; Companies see requests for their company
  - `allow update`: Companies only; status transitions from "pending" to "approved"/"denied"
  - `allow delete`: Disabled (soft-delete pattern only)

### Epic E6 (Manage Profile) — Profile Dependencies on Wallet (19 April 2026)

- Profile identity context now enables downstream Manage Wallet flows
- Session persistence stores profile identifiers and association fields needed by wallet request routing
- Scoped user creation now initializes wallet baseline during user creation (cross-epic dependency)

### Epic E10 (Manage Users) — Scoped User Creation with Wallet Baseline (19 April 2026)

**Wallet Baseline Initialization on Scoped User Creation** ✅

- Scoped user creation (`src/app/api/users/create-scoped/route.ts`) now initializes wallet state atomically
- All newly created Professional/Individual users receive 10 initial coins via `INITIAL_SIGNUP_COINS = 10`
- Wallet doc + transaction ledger entry written in single Firestore transaction with user creation
- Downstream wallet pages load balances immediately post-creation without manual seeding
- Users can access `/<tenant>/manage-wallet` immediately after creation and see initialized balance

Pending phases:

- full regression testing after all phases complete
- remove legacy files from `src/modules/coaching-studio/` only after final verification

Removal tracking (planned, not deleted yet):

- `src/modules/coaching-studio/MyActivitiesPage.tsx`
- `src/modules/coaching-studio/MyActivitiesPage.module.css`
- `src/modules/coaching-studio/AssignedActivitiesPage.tsx`
- `src/modules/coaching-studio/AssignedActivitiesPage.module.css`
- `src/modules/coaching-studio/DetailModal.tsx`
- `src/modules/coaching-studio/DetailModal.module.css`
- `src/modules/coaching-studio/AssignmentModal.tsx`
- `src/modules/coaching-studio/AssignmentModal.module.css`
- `src/modules/coaching-studio/menuConfig.ts`
- `src/modules/coaching-studio/profile/CoachingProfilePage.tsx`
- `src/modules/coaching-studio/profile/CoachingProfilePage.module.css`
- `src/modules/coaching-studio/CoachingProgramsPage.tsx`
- `src/modules/coaching-studio/CoachingProgramsPage.module.css`
- `src/modules/coaching-studio/CoachingEventsPage.tsx`
- `src/modules/coaching-studio/CoachingEventsPage.module.css`
- `src/modules/coaching-studio/CoachingToolsPage.tsx`
- `src/modules/coaching-studio/ManageWalletPage.tsx`
- `src/modules/coaching-studio/ManageWalletPage.module.css`
- `src/modules/coaching-studio/CoachingLandingPage.tsx`
- `src/modules/coaching-studio/CoachingLandingPage.module.css`
- `src/modules/coaching-studio/useCarousel.ts`
- `src/modules/coaching-studio/CoachingViewAllHeader.tsx`
- `src/modules/coaching-studio/CoachingViewAllHeader.module.css`
- `src/modules/coaching-studio/auth/AuthWizard.tsx`
- `src/modules/coaching-studio/auth/AuthWizard.module.css`
- `src/modules/coaching-studio/auth/LoginRegisterModal.tsx`
- `src/modules/coaching-studio/auth/LoginRegisterModal.module.css`
- `src/modules/coaching-studio/dashboard/CoachingDashboard.tsx`
- `src/modules/coaching-studio/dashboard/CoachingDashboard.module.css`

## Project model

StudioVerse is:

- one repository
- one shared codebase
- three Studio deployments
- one shared authenticated app shell
- separate Studio-specific landing pages
- Firebase-backed
- Vercel-deployed

The repository must stay aligned with this architecture at all times.[file:181]

## Core rule

Prefer shared code over duplication.

If Coaching Studio, Training Studio, and Recruitment Studio differ only in labels, copy, branding, or small behavior toggles, use configuration instead of creating separate implementations.[file:181]

## Studio differences

Use config-driven variation for:

- terminology
- role labels
- branding
- support metadata
- feature flags
- navigation labels
- app-shell copy

Do not create separate feature implementations per Studio unless the underlying functionality is genuinely different.[file:181]

## Config boundary

Keep these two config systems separate:

1. `src/tenants/*` and `src/config/studio.ts`
   - authenticated app-shell config
   - terminology
   - role labels
   - branding
   - feature flags
   - runtime Studio behavior

2. `src/modules/marketing/*/content.config.ts`
   - landing-page copy
   - SEO metadata
   - counters
   - CTA text
   - public marketing sections

Never mix landing-page marketing content into app-shell Studio config, and never put authenticated app behavior inside landing-page content config.[file:181]

## Routing model

Follow the Next.js App Router conventions already defined for this repo.

Rules:

- landing pages live in Studio-specific routes under `src/app/`
- shared app-shell pages are mounted under each tenant prefix (for example `src/app/training-studio/dashboard/page.tsx`)
- public widget routes stay separate
- domain/host rewrites are handled in `src/proxy.ts` using `src/lib/tenant/routing.ts`
- do not invent alternative route structures unless the docs explicitly require them[file:181]

## Data access rule

Do not access Firestore directly from React components.

Use this separation:

- components render UI
- hooks manage client behavior
- services perform Firestore reads/writes
- Firebase Functions perform trusted server-side business logic

No component should import Firestore query helpers directly.[file:181]

## Service layer rule

All Firestore access must go through `src/services/`.

Service rules:

- functions are async
- return typed results
- accept required scope such as `studioType`
- catch and log errors
- rethrow typed application errors, not raw Firebase errors
- do not leak Firestore-specific failure details to the UI[file:181]

## Firebase import rule

Keep Firebase SDK usage contained.

Allowed places for Firebase imports:

- `src/services/firebase.ts`
- `src/services/*`
- Firebase Functions backend code

Avoid spreading Firebase SDK usage across arbitrary UI files.[file:181]

## Trusted logic rule

Put sensitive or trusted workflows in Firebase Functions, not in the client.

Examples:

- report generation
- audit logging
- role/context rebuilds
- notification sending
- assignment expansion logic
- permission-sensitive writes

If a workflow should not be trusted to the browser, it belongs in Functions.[file:181]

## Security rule

Security must exist at multiple layers:

- route guards
- service-layer discipline
- Firestore rules
- Functions-side auth and validation
- environment isolation

Never assume client-side checks alone are sufficient.[file:181]

## Tenant isolation rule

StudioVerse uses Studio-level and role-level isolation.

Always enforce:

- `studioType` scoping on tenant data
- `professionalId` scoping where relevant
- role-aware data access
- no cross-Studio data leakage

`studioType` must come from trusted app context, not user-entered values or URL hacks.[file:181]

## Role model

Use the stable internal roles:

- `superadmin`
- `company`
- `professional`
- `individual`

These identifiers should remain stable in code and Firestore. User-facing labels may vary by Studio through config.[file:181]

## Naming rule

Use typed constants instead of string literals whenever possible.

Important constants belong in:

- `src/constants/roles.ts`
- `src/config/studio.ts`
- `src/constants/site.ts`

Do not scatter magic strings for roles, Studio types, or core routes across the codebase.[file:181]

## Folder rule

Respect the defined repository structure.

Use:

- `src/app/` for routes and layouts
- `src/modules/` for feature modules
- `src/services/` for data access
- `src/hooks/` for hooks
- `src/store/` for shared client state
- `src/tenants/` for Studio app config
- `src/lib/tenant/` and `src/proxy.ts` for tenant resolution and routing
- `src/utils/` for utilities
- `functions/` for backend logic

Do not create ad hoc parallel patterns unless the existing structure cannot support the requirement.[file:181]

## Component rule

Components should stay focused on presentation.

Rules:

- use function components only
- keep business logic out of components
- keep Firestore calls out of components
- prefer module-level composition
- extend shared UI primitives instead of reinventing them
- keep props typed locally and clearly[file:181]

## Form rule

Use the standard form stack:

- `react-hook-form`
- `zod`
- shared form components where applicable

Forms should validate on the client for UX, but authoritative validation must also exist on the backend where required.[file:181]

## Error handling rule

Never expose raw Firebase, Firestore, or backend error messages to users.

Use:

- typed application errors
- user-friendly fallback messaging
- retry/recovery options
- centralized logging

Handle loading, empty, and error states explicitly in data-driven UI.[file:181]

## Logging rule

Logging should be structured and environment-aware.

Rules:

- frontend logging goes through `src/lib/logger.ts`
- dev can log to console
- staging/prod should reduce noise and route important errors to monitoring
- Firebase Functions should use `functions.logger`
- do not leave raw `console.log` in production paths[file:181]

## Environment rule

Studio type and deployment environment are different things.

Treat them separately:

- Studio type: `coaching` | `training` | `recruitment`
- environment: `dev` | `staging` | `prod`

Do not hardcode environment behavior into Studio logic or Studio behavior into environment logic.[file:181]

## Local dev rule

For local development:

- use `.env.example` as the variable template
- keep `.env.local` uncommitted
- use `NEXT_PUBLIC_STUDIO_TYPE` for app-shell Studio switching
- use Firebase emulators in dev
- keep local flows aligned with the documented setup process[file:181]

## Firebase auth implementation notes (Apr 2026)

Current implementation baseline:

- Firebase Phone Auth uses standard `RecaptchaVerifier` flow in `src/app/test/auth/page.tsx`
- Enterprise App Check wiring was removed from frontend bootstrap and auth diagnostics
- Keep `src/services/firebase.ts` free from `initializeAppCheck` and Enterprise providers unless explicitly re-approved

Operational behavior validated in this repo:

- localhost supports configured Firebase test phone numbers
- localhost is not reliable for real (non-test) phone OTP; use deployed HTTPS domain for real-number validation
- Vercel real-number OTP works only when exact hostname is present in Firebase Auth Authorized domains

Environment variables currently required for web Firebase initialization:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Superadmin seeding behavior:

- Initial superadmin profile is auto-seeded via `ensureSuperadminProfile` in `src/modules/admin/SuperAdminPortal.tsx`
- Seed trigger is first successful login with `MASTER_SUPERADMIN_PHONE_E164`
- Only the configured master superadmin phone auto-seeds; other numbers require existing records

Domain and testing guardrails:

- Auth domain matching is exact; use the same hostname as browser address bar
- Validate OTP flows in order: localhost test number, deployed test number, deployed real number
- Keep auth in `AUDIT` mode during setup and switch to stricter enforcement only after stable validation

## Branching rule

Follow the documented git model:

- `main` for production-ready code
- `staging` for pre-production validation
- `dev` for active development
- feature/fix/hotfix branch naming conventions

Do not assume direct changes to protected branches.[file:181]

## Code quality rule

Generated code should pass baseline engineering checks:

- TypeScript strict mode
- ESLint
- build success
- consistent formatting
- no unnecessary `any`
- no undocumented `@ts-ignore`

If a type is uncertain, define or refine the type instead of weakening the code unnecessarily.[file:181]

## Build rule

Code should be safe across all three Studio builds.

When adding Studio-aware logic:

- avoid assumptions that only work for one Studio
- prefer config lookup over branching
- ensure imports and routes remain valid for all deployments
- keep build behavior deterministic across coaching, training, and recruitment[file:181]

## Preferred implementation pattern

When generating code, default to this order of thinking:

1. Can this be shared?
2. Can Studio variation come from config?
3. Does UI stay separate from data access?
4. Does sensitive logic belong in Functions?
5. Are role, tenant, and environment boundaries preserved?
6. Are types, constants, and folder conventions respected?[file:181]

## Avoid these mistakes

Do not generate code that:

- hardcodes “Coach” where config should supply the label
- queries Firestore directly inside components
- mixes landing-page copy into app-shell config
- stores secrets in frontend code
- trusts client-only validation for sensitive flows
- bypasses service abstractions
- ignores `studioType` filtering
- duplicates the same feature three times for three Studios[file:181]

## Good output checklist

Good generated code in this repo should be:

- typed
- modular
- config-driven
- service-oriented
- security-aware
- emulator-friendly
- environment-aware
- aligned with the shared app-shell architecture[file:181]

## Read these docs

Before making major changes, consult:

- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/E0.md`
- `docs/E1.md`
- `docs/T0.md`
- `docs/T1.md`
- `docs/T2.md`
- `docs/T3.md`
- `docs/T4.md`
- `docs/T5.md`

Use this file as the short instruction layer and those files as the detailed implementation context.[file:181]

## Progress update — Coaching Studio headers and catalogs (Apr 10, 2026)

Completed behavior baseline for Coaching Studio:

- Programs and Events View All pages are implemented and use a common header pattern.
- Assessment Centre, Programs, and Events top links route by context:
  - Landing page: links target in-page anchors.
  - View All and Dashboard: links target the respective View All routes.
- Header logo is clickable and returns to the Coaching Studio landing page.

Uniform header state model now implemented:

- Not logged in on Landing: coach/learner toggle visible, Sign In/Register visible.
- Not logged in on View All: coach/learner toggle visible, Sign In/Register visible.
- Logged in on Landing: coach/learner toggle hidden, initials menu shown.
- Logged in on View All: coach/learner toggle hidden, initials menu shown.
- Logged in on Dashboard: clickable logo + View All links + initials menu.

Auth/session persistence fix applied:

- Session uid is stored as Firebase uid in login/register flows.
- Header login state checks use Firebase user plus tenant session markers (`cs_uid` / `cs_role` / `cs_name`) to avoid false logged-out state when navigating between Landing, View All, and Dashboard.

UI polish completed:

- Active View All top-nav item uses pill styling with proper horizontal padding for readable spacing.

## Progress update — E4 Assessment Centre admin authoring (Apr 10, 2026)

Completed behavior baseline for SuperAdmin Assessment Centre:

- SuperAdmin menu label updated from Manage Tools to Manage Assessments.
- Tools menu route now renders Assessment management UI (`AssessmentsSection`) instead of a placeholder card.
- Assessment dashboard metric in SuperAdmin now reads from Firestore `assessments` collection (label: Total Assessments) instead of `tools`.

Assessment master-data authoring implemented:

- Assessment create/edit form includes E4 metadata fields:
  - name, short/long description
  - assessment context and participant benefit
  - assessment type and render style
  - question bank count and questions per attempt
  - AI analysis prompt and AI question-generation prompt
  - status, publication state, ownership scope, owner entity id
- Assessment-level image upload is implemented (separate from question image):
  - file picker in assessment form (JPG/PNG/WebP, 2MB limit)
  - upload to Firebase Storage path: `assessments/{tenantId}/{assessmentId}/cover.{ext}`
  - persisted fields: `assessmentImageUrl`, `assessmentImagePath`
  - existing image preview shown during edit.

AI question generation and table workflow implemented:

- Prompt placeholder replacement supported: `[No of Questions]` is replaced with form question count before API call.
- Question generation API route added at `src/app/api/assessments/generate-questions/route.ts`.
- Groq response parsing hardened for real-world payloads:
  - JSON fenced blocks / wrapped payloads
  - snake_case and camelCase key variants
  - option arrays and option maps
  - normalization to consistent question shape.
- Generated questions are shown in a scrollable table with fetch success/error feedback.
- Get More appends additional questions to the current table set.

Question persistence model implemented:

- Assessment questions are stored in Firestore `assessmentQuestions` with `assessmentId` linkage.
- Correct answer model updated for future styles:
  - `correctAnswers: string[]` (single-choice uses one value; multi-answer uses multiple values).
- Edit mode behavior:
  - existing questions are loaded into the table from `assessmentQuestions`
  - newly fetched questions append after existing rows
  - on save (edit), only newly appended questions are inserted; existing rows are preserved.

Current architecture note:

- Assessment authoring is implemented for Coaching Studio admin flow first.
- Participant runtime renderers for style-specific delivery are intentionally deferred (E4 next step).

## Progress update — E4/E5 landing, wallet, and admin flows (Apr 11, 2026)

Completed behavior baseline added after the Apr 10 implementation:

- Coaching Studio Assessment Centre View All page is now implemented at `src/app/coaching-studio/tools/page.tsx`.
- The View All Assessment page now reads from Firestore `assessments`, filters by tenant, and renders real assessment tiles instead of placeholder copy.
- Coaching Studio landing page tools carousel now uses Firestore-backed assessments instead of static tenant config items.
- Coaching Studio landing page events carousel now uses Firestore-backed events only; static config fallback for events was removed.

Landing page catalog behavior now follows this rule:

- If promoted records exist, show promoted records first.
- If no promoted records exist, fall back to published/active records.
- If the returned count is below the configured carousel limit, repeat items to fill the configured carousel size.
- Carousel fill continues to respect `landingContent.carouselItemLimits` from tenant config.

Wallet / coins implementation completed for Coaching Studio and SuperAdmin:

- New SuperAdmin menu item: Manage Coins.
- SuperAdmin dashboard includes a wallet summary tile showing utilized vs issued coins.
- Dashboard tiles are clickable and route directly to the relevant management view.
- Manage Coins flow implemented with tenant selection, user-type selection, user dropdown, coin amount input, and assignment action.
- My Wallet panel added to Coaching Studio dashboard and reads wallet balance for the logged-in user using session key `cs_uid`.
- Wallet persistence model implemented with Firestore collections:
  - `wallets`
  - `walletTransactions`
- Coin assignment uses Firestore transactions for atomic wallet updates plus ledger entry creation.

Manage Coins implementation notes:

- Target user types are fixed as `company`, `professional`, and `individual`.
- Tenant must be selected before user lookup runs.
- User dropdown loading was debugged and hardened with:
  - explicit tenant/user-type change logging
  - cancellation guard against stale async state updates
  - tenant slug normalization for `_` vs `-` mismatches.
- Canonical tenant slug should be `coaching-studio` everywhere in tenant and user records.

Assessment admin and deploy notes:

- Assessment authoring save payload was adjusted so Firestore write objects use `Record<string, unknown>` instead of `Omit<AssessmentRecord, "id">` for timestamp fields.
- This avoids Vercel TypeScript build failures caused by assigning Firestore `serverTimestamp()` (`FieldValue`) to model fields typed as `Timestamp`.

Operational note from current workspace state:

- Firestore was intentionally reset on Apr 11, 2026 for clean reseeding.
- Deleted collections/documents included assessments, assessmentQuestions, programs, events, tenants, and all non-superadmin users.
- Only the two superadmin user documents were preserved.
- Any missing landing-page or admin data after this point may be due to the reset and require reseeding in Firestore.

## Progress update — E7 Activity Assignment, E8 Role Menus, E5 Manage Wallet, build fix (Apr 12, 2026)

### E7 — Activity Assignment and Self-Registration

Full multi-stage assignment modal implemented at `src/modules/coaching-studio/AssignmentModal.tsx`:

- Stage machine: `search → found | not_found → confirm`.
- Search by phone or email via `searchUsersByPhoneOrEmail` in `src/services/assignment.service.ts`.
- Found path: target user details shown read-only at confirmation stage; no editable fields.
- Not-found path: all four fields are required — first name, last name, plus the missing contact field (if searched by phone, email is captured; if searched by email, phone is captured).
- Self-assignment: Register Now and Try Now buttons on `DetailModal` set a self-assign flag; the modal auto-populates from the logged-in session and skips the search stage.
- Assignment confirmation popup shown after success; placeholder mail utility `src/services/mail.service.ts` returns `{ success: true, message: "Mail sent" }`.
- Recommendation flow: Recommend button creates a record with `status: "recommended"` in the `assignments` collection using `createRecommendation`.

Unknown assignee auto-provisioning (in `assignment.service.ts`):

- If a searched assignee is not found, a new `Individual` user document is created in `users`.
- A zero-balance wallet document is created in `wallets` for the new user.
- Assignment record is then written with the provisioned user's identity.

Wallet ownership rule (implemented and documented):

- Assign-to-other debits the **assignor** wallet, not the assignee wallet.
- Self-assignment debits the logged-in user's own wallet.
- Assignments where `creditsRequired === 0` skip all wallet validation entirely; no debit record is written.

Identity resolution pattern (recurring fix):

- Users and wallets are looked up by multiple identifiers: `uid`, `userId`, `profileId`, stored session ids, `phoneE164`, and `email`.
- Session keys persisted across login/register: `cs_uid`, `cs_profile_id`, `cs_phone`, `cs_email`, `cs_name`, `cs_role`.
- Firebase Auth `displayName` is set during registration to resolve "User User" self-assignment name issues.

### E7 — My Activities page

New page at `src/modules/coaching-studio/MyActivitiesPage.tsx` with route `src/app/coaching-studio/my-activities/page.tsx`:

- Resolves assignee identity from Firebase Auth plus profile service on load.
- Fetches assignments by all known identifiers using `getAssignmentsForAssigneeContext`.
- Radio filters: All / Assessments / Programs / Events.
- Shows both `assigned` and `recommended` status records.

### E5 — Manage Wallet (renamed from Manage Coins)

Terminology: "Manage Coins" is renamed to "Manage Wallet" throughout all UI, routes, and documentation.

SuperAdmin Manage Wallet page (`ManageCoinsSection.tsx`) redesigned:

- Wallet list loads first, showing all existing wallets.
- Radio filters: All / Company / Professional / Individual.
- Explicit wallet creation form for users who have no wallet.
- Coin assignment (credit) updates `wallets/{userId}` and creates a `walletTransactions` credit ledger row.

User Manage Wallet page at `src/modules/coaching-studio/ManageWalletPage.tsx` with route `src/app/coaching-studio/manage-wallet/page.tsx`:

- Shows wallet balance summary for the logged-in user.
- Lists full transaction history (credits and debits) from `walletTransactions`, resolved by `userId`, `createdBy`, and `walletId`.

Extended `walletTransactions` schema fields (now live):

- `transactionType`: `credit` (admin issuance) or `debit` (assignment spend).
- `reason` (optional string).
- `assignmentId` (optional, present on debit records).
- `activityType`, `activityId` (optional, present on debit records).

### E8 — Role-based menus

Both the CoachingDashboard and CoachingViewAllHeader (shared logged-in dropdown) now implement the E8 access matrix:

- Company: Dashboard, Update Profile, Manage Wallet, My activities, Sign Out.
- Professional: Dashboard, Update Profile, Manage Wallet, My activities, Sign Out.
- Individual (Learner): Dashboard, Update Profile, Manage Wallet, My activities, Sign Out.
- SuperAdmin: full admin portal menu.
- Menu order, labels, and routes are consistent between dashboard and shared header dropdown.

Visual consistency: coaching-user logged-in dropdown opacity and style aligned toward the solid SuperAdmin menu treatment.

### TypeScript build fix — Vercel deployment (Apr 12, 2026)

Root cause: `Omit<AssignmentRecord, "id">` typed write payloads in `assignment.service.ts` rejected `serverTimestamp()` (`FieldValue`) because the record type has `createdAt?: Timestamp`.

Fix applied: write payloads for assignment and recommendation creates now use `WithFieldValue<Omit<AssignmentRecord, "id">>` (imported from `firebase/firestore`). The stored record type is unchanged. `npm run build` now passes clean.

Pattern to follow going forward: any Firestore write object that uses `serverTimestamp()` must be typed with `WithFieldValue<T>`, not the raw record type.

### Documentation sync (Apr 12, 2026)

All nine epic docs updated:

- `docs/E0.md` to `docs/E8.md` — implementation status snapshots added.
- `docs/E5.md` — "Manage Coins" corrected to "Manage Wallet" in key functional requirements.
- `docs/E7.md` — assignment/recommendation/self-registration rules corrected to match implementation.
- `docs/E8.md` — role menu implementation snapshot added; My activities and Manage Wallet noted as live routes.
- `docs/FIREBASE_PROD_ROLLOUT_RUNBOOK.md` — extended with E7 assignments section (collection schema, required indexes, rules, smoke tests), E8 pre-prod checks, updated walletTransactions schema (debit type + extra fields), wallet ownership rule, and the TypeScript build fix note.
