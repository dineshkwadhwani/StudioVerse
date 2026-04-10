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

1. `src/config/studios/*`
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
- authenticated routes live under `src/app/(app)/`
- public widget routes stay separate
- route constants should be defined in `src/constants/routes.ts`
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
- `src/lib/firebase.ts`
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
- `src/constants/studio.ts`
- `src/constants/routes.ts`
- `src/constants/site.ts`

Do not scatter magic strings for roles, Studio types, or core routes across the codebase.[file:181]

## Folder rule

Respect the defined repository structure.

Use:
- `src/app/` for routes and layouts
- `src/modules/` for feature modules
- `src/services/` for data access
- `src/hooks/` for hooks
- `src/stores/` for Zustand stores
- `src/config/studios/` for Studio app config
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