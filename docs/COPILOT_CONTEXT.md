# Copilot Context — StudioVerse

Status: Working instruction file for AI-assisted code generation in this repository.  
Read this before generating or modifying code.

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