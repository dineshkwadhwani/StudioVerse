# StudioVerse — Technical Stories PRD
**Version 1.0 | March 2026 | Classification: Confidential — Engineering Use**
**Document Type: Technical Epic Specification**

---

## Preamble

This document is the canonical technical specification for all Technical Epics and User Stories in the StudioVerse platform. It covers the foundational engineering work that must be completed before any functional product epics (E0 onwards) can be built or deployed.

Technical Epics are not features. They are the engineering infrastructure, architecture patterns, tooling, security baseline, and deployment scaffolding that the entire platform depends on.

This document is the source of truth for developers executing technical setup work. Every decision recorded here reflects the StudioVerse architecture — one repository, one codebase, three Studio deployments (Coaching Studio, Training Studio, Recruitment Studio) — as defined in the StudioVerse Technical Architecture MASTER v2 and the StudioVerse Database Specification MASTER v2.

---

## Status Summary

| Epic | Title | Stories | Status |
|------|-------|---------|--------|
| T0 | Project Setup & Dev Environment | 10 | ✅ DONE |
| T1 | Firebase Backend Setup | 10 | 🔄 PARTIAL (T1-01 to T1-08 Done) |
| T2 | Frontend Architecture | 10 | 🔲 NOT STARTED |
| T3 | Deployment & DevOps | 10 | 🔄 PARTIAL (T3-01, T3-02 Done) |
| T4 | Security & Access Control | 10 | 🔲 NOT STARTED |
| T5 | Studio Config Architecture | 7 | 🔲 NOT STARTED |

---

## EPIC T0 — Project Setup & Dev Environment
**Priority:** P0 | **Status:** ✅ COMPLETE
**Goal:** Establish a consistent, reproducible developer environment and project standards for the StudioVerse monorepo.

---

### US-T0-01 — Create Git Repository
**Status:** ✅ Done

**Description:**
Create the single GitHub repository that will house the entire StudioVerse codebase. All three Studio deployments (Coaching Studio, Training Studio, Recruitment Studio) are served from this one repository.

**Repository name:** `studioverse`
**Visibility:** Private
**Owner:** Organisation or personal account as decided by team lead

**Acceptance Criteria:**
- Repository created on GitHub under the agreed organisation or account
- Repository is private
- Initial commit exists (even if just a README)
- All team members with a development role have been granted appropriate access

---

### US-T0-02 — Define Branching Strategy
**Status:** ✅ Done

**Description:**
Define and document the Git branching model used across the studioverse repository.

**Branching model:**
- `main` — production-ready code only. Auto-deploys to production Vercel on merge.
- `staging` — staging-ready code. Auto-deploys to staging Vercel on merge.
- `dev` — active development branch. Auto-deploys to dev Vercel on merge.
- `feature/[story-id]-[short-description]` — individual feature branches cut from `dev`
- `fix/[story-id]-[short-description]` — bug fix branches
- `hotfix/[description]` — emergency production patches cut from `main`

**Rules:**
- No direct commits to `main` or `staging`
- All merges to `main` require Pull Request and at least one approval
- Branch names must follow the naming convention above
- Stale branches older than 30 days should be deleted after merge

**Acceptance Criteria:**
- Branching strategy documented in README or CONTRIBUTING.md
- Branch protection rules applied to `main` on GitHub
- Team members briefed on branching conventions

---

### US-T0-03 — Setup Local Dev Guide
**Status:** ✅ Done

**Description:**
Document the complete local development setup process so any developer can onboard and run the project from scratch.

**Guide must cover:**
- Prerequisites (Node.js version, npm/yarn/pnpm, Firebase CLI, Git)
- Cloning the repository
- Installing dependencies
- Setting up local `.env` files (using `.env.example` as template)
- Running the local dev server
- Running Firebase emulators
- Running linting and type checking
- Building the project locally
- How to switch Studio type locally using `NEXT_PUBLIC_STUDIO_TYPE`

**Acceptance Criteria:**
- `README.md` contains complete setup instructions
- A `.env.example` file exists with all required keys (no values)
- A new developer can run the project locally following only the README

---

### US-T0-04 — Install Dependencies
**Status:** ✅ Done

**Description:**
Install and lock all core platform dependencies required by the StudioVerse codebase.

**Core dependencies:**
- `next` (App Router, latest stable)
- `react` and `react-dom`
- `typescript`
- `tailwindcss` + `postcss` + `autoprefixer`
- `@shadcn/ui` component library
- `zustand` (state management)
- `firebase` (client SDK)
- `firebase-admin` (Functions SDK)
- `@capacitor/core` + `@capacitor/cli` + `@capacitor/android` + `@capacitor/ios`
- `react-hook-form` + `zod` (form handling and validation)
- `lucide-react` (icons)
- `clsx` + `tailwind-merge` (class utilities)

**Dev dependencies:**
- `eslint` + `eslint-config-next`
- `prettier`
- `@types/node`, `@types/react`, `@types/react-dom`
- `typescript`

**Acceptance Criteria:**
- `package.json` contains all required dependencies
- `package-lock.json` or equivalent lockfile is committed
- `npm install` runs without errors on a clean clone
- No known critical vulnerabilities in installed packages

---

### US-T0-05 — Setup Next.js Project
**Status:** ✅ Done

**Description:**
Initialise the Next.js project using the App Router pattern as defined in the StudioVerse Technical Architecture.

**Configuration:**
- Use `create-next-app` with App Router enabled
- TypeScript enabled by default
- `src/` directory structure (all code lives under `src/`)
- Tailwind CSS configured at project init
- `@` path alias configured for `src/` directory

**`next.config.js` must include:**
- Image domain allowlists for Firebase Storage
- Any required redirects for Studio-type routing
- No `output: export` — the app uses SSR and server components

**Acceptance Criteria:**
- `src/app/` directory exists and uses App Router conventions
- `npm run dev` starts the dev server successfully
- `npm run build` completes without errors
- TypeScript path alias `@/*` resolves correctly to `src/*`

---

### US-T0-06 — Setup TypeScript
**Status:** ✅ Done

**Description:**
Configure TypeScript for strict type safety across the entire StudioVerse codebase.

**`tsconfig.json` settings:**
- `"strict": true` — enforces strict type checking
- `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"paths"` configured for `@/*` alias
- `"moduleResolution": "bundler"` for Next.js App Router compatibility
- `"target": "ES2017"` or later

**Rules:**
- No `// @ts-ignore` comments permitted without documented justification
- No `any` types without documented justification
- All function parameters and return types must be explicitly typed
- Shared types live in `src/types/` or within their module's `types.ts`

**Acceptance Criteria:**
- `npx tsc --noEmit` runs without errors on the baseline project
- `tsconfig.json` has `strict: true`
- TypeScript errors block the build (enforced by Next.js build pipeline)

---

### US-T0-07 — Setup ESLint + Prettier
**Status:** ✅ Done

**Description:**
Configure code quality and formatting tools to enforce consistency across all contributors.

**ESLint configuration:**
- Use `eslint-config-next` as the base
- Add rules for: no unused variables, no console.log in production code, consistent imports
- TypeScript-aware rules enabled

**Prettier configuration:**
- `printWidth: 100`
- `singleQuote: true`
- `semi: false`
- `tabWidth: 2`
- `trailingComma: 'es5'`
- Prettier and ESLint configured to not conflict (use `eslint-config-prettier`)

**Pre-commit hook (optional but recommended):**
- `husky` + `lint-staged` to run ESLint and Prettier on staged files before commit

**Acceptance Criteria:**
- `npm run lint` runs ESLint without errors on the baseline codebase
- `npm run format` runs Prettier without errors
- ESLint and Prettier configs committed to the repository
- VS Code settings file (`.vscode/settings.json`) added with format-on-save enabled

---

### US-T0-08 — Setup Environment Variables
**Status:** ✅ Done

**Description:**
Define and document the full environment variable strategy for StudioVerse across all environments and all Studio types.

**Variable categories:**

1. **Studio Identity (app shell only — not used for landing pages)**
   - `NEXT_PUBLIC_STUDIO_TYPE` — `coaching` | `training` | `recruitment`
     NOTE: This variable drives terminology, RBAC labels, and dashboard copy
     inside the authenticated `(app)` shell only. Landing pages are served from
     their own directories and do NOT depend on this variable.
     For local dev, this variable tells the app shell which Studio context
     to load after login.

2. **Firebase Client (public — prefixed `NEXT_PUBLIC_`)**
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

3. **App Config (public)**
   - `NEXT_PUBLIC_APP_ENV` — `dev` | `staging` | `prod`
   - `NEXT_PUBLIC_APP_BASE_URL`
   - `NEXT_PUBLIC_ENABLE_MOCK_SESSION` — `true` | `false`

4. **Backend secrets (server-side only — Firebase Functions env or Vercel server env)**
   - `FIREBASE_SERVICE_ACCOUNT_KEY`
   - `GROQ_API_KEY`
   - `RESEND_API_KEY`
   - `STRIPE_SECRET_KEY` (Post-MVP)

**Rules:**
- All `NEXT_PUBLIC_` variables are safe to expose to the browser
- All secrets must live in Firebase Functions config or Vercel server environment — never in `NEXT_PUBLIC_` variables
- `.env.local` is gitignored
- `.env.example` is committed with all keys but no values

**Acceptance Criteria:**
- `.env.example` committed with all required keys
- `.env.local` is in `.gitignore`
- Application reads Studio type correctly from `NEXT_PUBLIC_STUDIO_TYPE`
- No secrets appear in any committed file or browser bundle

---

### US-T0-09 — Setup README
**Status:** ✅ Done

**Description:**
Create a comprehensive README that serves as the entry point for all developers working on StudioVerse.

**README must include:**
- Project overview (StudioVerse — one codebase, three Studios)
- Tech stack summary
- Prerequisites
- Local setup instructions (reference to Dev Guide)
- Environment variable setup
- How to run dev server
- How to run emulators
- How to build for web
- How to build for mobile (Capacitor)
- How to switch Studio type
- Branching and contribution guide
- Link to key architecture documents

**Acceptance Criteria:**
- README.md exists at repository root
- A new developer can follow it from zero to running local dev server
- Studio switching instructions are clearly documented

---

### US-T0-10 — Commit Convention
**Status:** ✅ Done

**Description:**
Establish a commit message convention to make the Git history readable and CI/CD automation reliable.

**Convention: Conventional Commits**
Format: `type(scope): description`

**Types:**
- `feat` — new feature or user story implementation
- `fix` — bug fix
- `chore` — tooling, config, dependency changes
- `docs` — documentation only
- `refactor` — code change that is neither a fix nor a feature
- `test` — adding or updating tests
- `style` — formatting changes only
- `ci` — CI/CD pipeline changes

**Scope examples:** `auth`, `dashboard`, `programs`, `tools`, `assignments`, `firebase`, `studio-config`

**Examples:**
- `feat(auth): implement Google SSO login`
- `fix(assignments): correct overdue detection timezone handling`
- `chore(deps): update firebase to v10.8.0`

**Acceptance Criteria:**
- Commit convention documented in README or CONTRIBUTING.md
- Team members briefed on convention
- Optional: `commitlint` configured to enforce convention on commit

---

## EPIC T1 — Firebase Backend Setup
**Priority:** P0 | **Status:** 🔄 PARTIAL (T1-01 to T1-08 Complete, T1-09 and T1-10 Pending)
**Goal:** Initialise the complete Firebase backend infrastructure that powers all three StudioVerse Studio deployments.

---

### US-T1-01 — Create Firebase Project (dev/staging/prod)
**Status:** ✅ Done

**Description:**
Create three Firebase projects — one per environment — to support complete environment isolation across development, staging, and production.

**Projects:**
- `studioverse-dev` — local development and feature testing
- `studioverse-staging` — pre-production QA and stakeholder review
- `studioverse-prod` — live production environment

**Per project, enable:**
- Firestore (Native mode, chosen region)
- Firebase Authentication
- Firebase Storage
- Firebase Functions (Blaze plan required for Functions)
- Firebase Hosting (optional — primarily using Vercel for frontend)

**Region guidance:** Choose a single region consistent across all three projects. Recommended: `asia-south1` (Mumbai) for India/UAE user base, or `us-central1` if global latency is preferred.

**Acceptance Criteria:**
- Three Firebase projects exist in the Firebase Console
- All three projects have Firestore, Auth, Storage, and Functions enabled
- Project IDs follow a consistent naming convention
- Firebase project IDs documented in `.env.example`

---

### US-T1-02 — Enable Firestore
**Status:** ✅ Done

**Description:**
Enable Cloud Firestore in Native mode on all three Firebase projects and configure initial settings.

**Settings:**
- Mode: Native (not Datastore)
- Region: Consistent with project region decision in T1-01
- Firestore rules: Set to locked mode initially (deny all) until T1-03 is complete

**Acceptance Criteria:**
- Firestore enabled in Native mode on all three projects
- Initial rules set to deny-all locked mode
- Firestore region confirmed and documented

---

### US-T1-03 — Setup Security Rules Baseline
**Status:** ✅ Done

**Description:**
Implement the initial Firestore security rules that enforce authentication and role-based access at the database layer.

**Baseline rules must enforce:**
- All reads and writes require authentication (`request.auth != null`)
- No unauthenticated access to any collection
- `studioType` field scoping on all tenant collections
- Placeholder rules for all 25 StudioVerse collections (deny-all with auth check as baseline, to be expanded per collection in T4-03)

**Acceptance Criteria:**
- `firestore.rules` file committed to repository
- Rules deployed to dev Firebase project
- Unauthenticated access to any collection returns permission-denied
- Authenticated access to own user document is permitted
- Rules pass Firebase emulator rule tests

---

### US-T1-04 — Setup Firebase Auth
**Status:** ✅ Done

**Description:**
Enable and configure Firebase Authentication for the StudioVerse platform.

**Auth providers to enable:**
- Email and Password
- Google Sign-In (OAuth)

**Auth settings:**
- Email enumeration protection: enabled
- Authorised domains: configured for dev, staging, and prod domains
- Custom email templates: placeholder configured (final branding applied in E2)

**Per-Studio auth isolation:**
- All three Studio types share Firebase Auth within the same project per environment
- Studio type is recorded in the user's Firestore `users` document, not in Firebase Auth custom claims (to avoid complexity)
- `studioType` is set during registration based on which Studio URL the user registered from

**Acceptance Criteria:**
- Email/Password and Google auth enabled on all three Firebase projects
- Authorised domains configured for each environment
- Auth emulator working locally

---

### US-T1-05 — Setup Firebase Storage
**Status:** ✅ Done

**Description:**
Enable and configure Firebase Storage for file uploads across the platform.

**Storage use cases:**
- User profile avatars
- Program module content (video, PDF, audio)
- AI-generated report PDFs
- Company and Studio logos

**Storage rules baseline:**
- Authenticated users can read their own files
- Authenticated users can upload to their own designated path
- Report PDFs are write-once (written by Functions only, not UI)
- Storage rules to be expanded per file type in T4

**Folder structure:**

```text
/avatars/{userId}/profile.jpg
/programs/{programId}/modules/{moduleId}/{filename}
/reports/{userId}/{toolId}/{reportId}.pdf
/companies/{companyId}/logo.jpg
```

**Acceptance Criteria:**
- Firebase Storage enabled on all three projects
- Baseline storage rules deployed
- Storage emulator working locally
- Folder structure documented

---

### US-T1-06 — Setup Firebase Functions
**Status:** ✅ Done

**Description:**
Initialise Firebase Functions (Cloud Functions Gen 2) as the server-side business logic layer for StudioVerse.

**Functions setup:**
- Runtime: Node.js 20
- Language: TypeScript
- Location: Same region as Firestore
- Functions live in `functions/` directory at repository root
- Functions use modular structure — one file per domain area

**Initial function stubs to create (empty but deployable):**
- `buildUserContext` — rebuilds userContexts document on user/role change
- `onToolSubmitted` — triggers report generation on tool completion
- `generateReport` — calls Groq API and creates PDF
- `sendNotificationEmail` — sends email via Resend
- `detectOverdueAssignments` — scheduled function (daily)
- `onCohortMemberAdded` — triggers late-join assignment expansion

**Functions folder structure:**

```text
functions/
src/
index.ts
auth/
buildUserContext.ts
assignments/
detectOverdue.ts
onCohortMemberAdded.ts
reports/
onToolSubmitted.ts
generateReport.ts
notifications/
sendEmail.ts
types/
index.ts
utils/
firestore.ts
validation.ts
package.json
tsconfig.json
.eslintrc.js
```

**Acceptance Criteria:**
- `functions/` directory initialised with TypeScript
- All function stubs created and deployable
- Functions deploy to dev Firebase project without errors
- Functions emulator runs locally

---

### US-T1-07 — Configure Firebase CLI
**Status:** ✅ Done

**Description:**
Configure the Firebase CLI for use across all three environments and project targets.

**`.firebaserc` configuration:**
```json
{
  "projects": {
    "dev": "studioverse-dev",
    "staging": "studioverse-staging",
    "default": "studioverse-prod"
  }
}
```

**`firebase.json` configuration:**
- Firestore rules and indexes targets defined
- Functions deploy target defined
- Storage rules target defined
- Hosting targets defined (optional if using Vercel for frontend)

**CLI aliases:**
- `firebase use dev` — switches to dev project
- `firebase use staging` — switches to staging project
- `firebase use default` — switches to prod project

**Acceptance Criteria:**
- `.firebaserc` committed with all three project targets
- `firebase.json` committed with correct configuration
- `firebase use dev` + `firebase deploy --only functions` succeeds
- All team members can deploy to dev using CLI

---

### US-T1-08 — Setup Firebase Emulator
**Status:** ✅ Done

**Description:**
Configure the Firebase Local Emulator Suite for full offline local development without touching real Firebase projects.

**Emulators to enable:**
- Authentication emulator (port 9099)
- Firestore emulator (port 8080)
- Functions emulator (port 5001)
- Storage emulator (port 9199)
- Emulator UI (port 4000)

**`firebase.json` emulator config:**
```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

**Application emulator detection:**
- When `NEXT_PUBLIC_APP_ENV=dev` and running locally, Firebase client SDK connects to emulators
- Emulator connection logic lives in `src/lib/firebase.ts`

**Acceptance Criteria:**
- `firebase emulators:start` runs all emulators without port conflicts
- Application connects to emulators when running locally in dev mode
- Emulator UI accessible at `localhost:4000`
- Seed data script available for local testing (optional but recommended)

---

### US-T1-09 — Define Firestore Collections (All 25)
**Status:** 🔲 Not Started

**Description:**
Create all 25 Firestore collections as defined in the StudioVerse Database Specification MASTER v2. This story covers the creation of the collection structure, initial index configuration, and composite index definitions.

**All 25 collections to define:**

| # | Collection | Purpose |
|---|-----------|---------|
| 1 | users | Master identity for all platform users |
| 2 | userContexts | Precomputed RBAC oracle per user |
| 3 | companies | Organisations managing multiple Professionals |
| 4 | companyMembers | Maps Professionals to Companies |
| 5 | professionalProfiles | Extended profile for Professional-role users |
| 6 | professionalRelations | Professional to Individual relationship graph |
| 7 | cohorts | Named groups of Individuals |
| 8 | cohortMembers | Maps Individuals to Cohorts |
| 9 | programs | Learning programs / courses / tracks |
| 10 | programModules | Content units within a Program |
| 11 | programProgress | Individual progress per module |
| 12 | tools | Assessment tools / evaluations |
| 13 | toolQuestions | Questions within a Tool |
| 14 | toolSubmissions | Submitted answers for a Tool |
| 15 | toolResults | Scored results from a submission |
| 16 | assignments | Core execution linking Individuals to Programs/Tools |
| 17 | events | Platform events, webinars, workshops |
| 18 | eventRegistrations | Individual registrations for Events |
| 19 | reports | AI-generated PDF reports |
| 20 | notifications | In-app notification records |
| 21 | widgetSessions | External widget usage sessions |
| 22 | auditLogs | Immutable audit trail |
| 23 | studioConfig | Per-Studio runtime config overrides |
| 24 | marketplace | Paid program and event listings |
| 25 | payments | Payment transaction records |

**Composite indexes required:**

```text
Collection: assignments
Fields: studioType ASC, professionalId ASC, status ASC, dueDate ASC

Collection: assignments
Fields: studioType ASC, individualId ASC, status ASC

Collection: programs
Fields: studioType ASC, status ASC, tags ARRAY_CONTAINS

Collection: tools
Fields: studioType ASC, status ASC

Collection: cohortMembers
Fields: cohortId ASC, status ASC

Collection: notifications
Fields: userId ASC, isRead ASC, createdAt DESC

Collection: auditLogs
Fields: studioType ASC, actorId ASC, createdAt DESC
```

**Acceptance Criteria:**
- All 25 collections documented in `firestore.indexes.json`
- Composite indexes defined and deployed to dev project
- Index deployment succeeds without errors
- Collections are consistent with Database Spec v2 schema definitions

---

### US-T1-10 — Logging Setup
**Status:** 🔲 Not Started

**Description:**
Implement a structured logging strategy for both the frontend application and Firebase Functions backend.

**Frontend logging:**
- Use a lightweight logger utility in `src/lib/logger.ts`
- In `dev` environment: logs to browser console
- In `staging` and `prod`: suppresses `console.log`, sends errors to monitoring provider
- Recommended provider: Sentry (free tier) or Firebase Crashlytics (for mobile)
- Logger interface:
```typescript
logger.info(message: string, context?: object): void
logger.warn(message: string, context?: object): void
logger.error(message: string, error?: Error, context?: object): void
```

**Functions logging:**
- Use Firebase Functions logger (`functions.logger`) for all server-side logs
- Structured log format: `{ level, message, studioType, userId, functionName, timestamp }`
- All errors caught in try/catch blocks and logged before rethrowing
- No raw `console.log` in Functions code

**Acceptance Criteria:**
- `src/lib/logger.ts` exists and is used across the codebase
- Functions use `functions.logger` consistently
- No raw `console.log` calls in production code paths
- Error monitoring provider configured for staging and prod

---

## EPIC T2 — Frontend Architecture
**Priority:** P0 | **Status:** 🔲 NOT STARTED
**Goal:** Define the frontend folder structure, component patterns, state management approach, service layer, and all shared engineering conventions that every functional epic will depend on.

---

### US-T2-01 — Define Folder Structure (studioverse repo)
**Status:** 🔲 Not Started

**Description:**
Establish the canonical folder and file structure for the entire StudioVerse frontend codebase.
Each Studio has its own dedicated landing page directory under `src/app/`. The authenticated
app shell is shared across all three Studios.

**Complete folder structure:**

```text
studioverse/
├── src/
│ ├── app/
│ │ ├── coaching-studio/
│ │ │ └── page.tsx # coachingstudio.io landing page
│ │ ├── training-studio/
│ │ │ └── page.tsx # trainingstudio.io landing page
│ │ ├── recruitment-studio/
│ │ │ └── page.tsx # recruitmentstudio.io landing page
│ │ ├── (app)/ # Authenticated app shell (shared)
│ │ │ ├── layout.tsx
│ │ │ ├── dashboard/
│ │ │ ├── programs/
│ │ │ ├── tools/
│ │ │ ├── events/
│ │ │ ├── cohorts/
│ │ │ ├── assignments/
│ │ │ ├── reports/
│ │ │ ├── notifications/
│ │ │ ├── settings/
│ │ │ └── admin/
│ │ ├── widget/
│ │ │ └── [toolId]/
│ │ │ └── page.tsx # Public embeddable widget
│ │ ├── login/
│ │ │ └── page.tsx
│ │ ├── register/
│ │ │ └── page.tsx
│ │ ├── layout.tsx # Root layout
│ │ ├── error.tsx
│ │ └── not-found.tsx
│ ├── modules/
│ │ ├── marketing/
│ │ │ ├── shared/ # Shared landing page components
│ │ │ │ ├── Header.tsx
│ │ │ │ ├── Footer.tsx
│ │ │ │ ├── HeroSection.tsx
│ │ │ │ ├── BenefitsSection.tsx
│ │ │ │ ├── ProgramsSection.tsx
│ │ │ │ ├── ToolsSection.tsx
│ │ │ │ ├── EventsSection.tsx
│ │ │ │ ├── ImpactCounters.tsx
│ │ │ │ ├── CTASection.tsx
│ │ │ │ └── ChatbotLauncher.tsx
│ │ │ ├── coaching-studio/ # Coaching Studio content config
│ │ │ │ └── content.config.ts
│ │ │ ├── training-studio/ # Training Studio content config
│ │ │ │ └── content.config.ts
│ │ │ └── recruitment-studio/ # Recruitment Studio content config
│ │ │ └── content.config.ts
│ │ ├── app-shell/
│ │ ├── auth/
│ │ ├── dashboard/
│ │ ├── admin/
│ │ ├── companies/
│ │ ├── professionals/
│ │ ├── cohorts/
│ │ ├── programs/
│ │ ├── tools/
│ │ ├── assignments/
│ │ ├── reports/
│ │ ├── events/
│ │ ├── notifications/
│ │ └── widget/
│ ├── config/
│ │ └── studios/
│ │ ├── studio.config.ts
│ │ ├── coaching.config.ts
│ │ ├── training.config.ts
│ │ └── recruitment.config.ts
│ ├── lib/
│ │ ├── firebase.ts
│ │ ├── analytics.ts
│ │ ├── logger.ts
│ │ └── seo.ts
│ ├── services/
│ │ ├── users.service.ts
│ │ ├── programs.service.ts
│ │ ├── tools.service.ts
│ │ ├── assignments.service.ts
│ │ ├── cohorts.service.ts
│ │ ├── reports.service.ts
│ │ ├── events.service.ts
│ │ └── notifications.service.ts
│ ├── hooks/
│ │ ├── useStudio.ts # Used inside (app) shell only
│ │ ├── useCurrentUser.ts
│ │ ├── useUserContext.ts
│ │ └── useIsMobile.ts
│ ├── stores/
│ │ ├── auth.store.ts
│ │ ├── studio.store.ts
│ │ └── notifications.store.ts
│ ├── types/
│ │ ├── studio.types.ts
│ │ ├── user.types.ts
│ │ ├── program.types.ts
│ │ ├── tool.types.ts
│ │ ├── assignment.types.ts
│ │ └── index.ts
│ ├── constants/
│ │ ├── roles.ts
│ │ ├── routes.ts
│ │ ├── studio.ts
│ │ └── site.ts
│ └── utils/
│ ├── cn.ts
│ ├── date.ts
│ ├── format.ts
│ ├── validation.ts
│ └── storage.ts
├── functions/
├── capacitor.config.ts
├── public/
│ └── studios/
│ ├── coaching-studio/
│ ├── training-studio/
│ └── recruitment-studio/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── firebase.json
├── .firebaserc
├── .env.example
└── README.md
```

**Key principles:**
- Each Studio landing page (`coaching-studio/page.tsx` etc.) imports shared marketing
  components from `modules/marketing/shared/` and passes its own `content.config.ts`
- The `useStudio()` hook and `studio.config.ts` are only used inside the `(app)` shell
  for terminology, RBAC labels, and dashboard copy — not on landing pages
- Landing page content is purely config-driven per Studio directory — no env var switching needed

**Acceptance Criteria:**
- All folders created in the repository (empty folders use `.gitkeep`)
- Folder structure matches this specification exactly
- `src/app/coaching-studio/page.tsx`, `src/app/training-studio/page.tsx`,
  and `src/app/recruitment-studio/page.tsx` all exist
- README updated to reflect folder structure

---

### US-T2-02 — Setup App Shell Layout
**Status:** 🔲 Not Started

**Description:**
Create the root layout and authenticated app layout that all pages will inherit from. This is the layout foundation that Epic E1 will build on.

**Root layout (`src/app/layout.tsx`):**
- Sets `<html lang>` and `<body>` with Tailwind base classes
- Loads fonts (Google Fonts or local — to be confirmed by design)
- Wraps children in global providers (Auth provider, Studio provider, Zustand stores)
- Includes global error boundary

**App shell layout (`src/app/(app)/layout.tsx`):**
- Authenticated layout shell
- Renders: AppHeader + AppSidebar (desktop) + main content area
- Reads `userContext` to determine role
- Redirects unauthenticated users to login (auth guard placeholder for E2)
- Passes Studio config context down via `useStudio()`

**Provider structure:**
```typescript
// Root providers wrapper
<StudioProvider>
  <AuthProvider>
    <NotificationsProvider>
      {children}
    </NotificationsProvider>
  </AuthProvider>
</StudioProvider>
```

**Acceptance Criteria:**
- `src/app/layout.tsx` exists with provider wrapping
- `src/app/(app)/layout.tsx` exists with shell structure
- `npm run build` succeeds with both layouts in place
- No TypeScript errors

---

### US-T2-03 — Routing Convention (App Router)
**Status:** 🔲 Not Started

**Description:**
Define and implement the complete route map for StudioVerse. Landing pages are served from
Studio-specific directories. Domain-to-route mapping is handled via `next.config.js` rewrites
so that each Studio domain shows a clean `/` URL to the visitor.

**Domain rewrite rules (`next.config.js`):**

```js
async rewrites() {
  return {
    beforeFiles: [
      {
        source: '/',
        destination: '/coaching-studio',
        has: [{ type: 'host', value: 'coachingstudio.io' }],
      },
      {
        source: '/',
        destination: '/training-studio',
        has: [{ type: 'host', value: 'trainingstudio.io' }],
      },
      {
        source: '/',
        destination: '/recruitment-studio',
        has: [{ type: 'host', value: 'recruitmentstudio.io' }],
      },
    ],
  }
},
```

**How it works:**
- Visitor hits `coachingstudio.io` → Vercel receives request → Next.js rewrites to
  `/coaching-studio` → renders `src/app/coaching-studio/page.tsx`
- The visitor's browser URL stays as `coachingstudio.io/` — the internal path is never exposed
- Same pattern for Training Studio and Recruitment Studio

**Full route map:**

| Route | Page | Auth Required | Roles |
|-------|------|--------------|-------|
| / (via domain rewrite) | Studio-specific landing page | No | Public |
| /login | Login page | No | All |
| /register | Registration page | No | All |
| /dashboard | Role-redirected dashboard | Yes | All |
| /dashboard/admin | SuperAdmin dashboard | Yes | superadmin |
| /dashboard/company | Company dashboard | Yes | company |
| /dashboard/professional | Professional dashboard | Yes | professional |
| /dashboard/individual | Individual dashboard | Yes | individual |
| /programs | Program catalog | Yes | All |
| /programs/[programId] | Program detail | Yes | All |
| /tools | Tool catalog | Yes | All |
| /tools/[toolId] | Tool detail / start | Yes | All |
| /events | Event list | Yes | All |
| /events/[eventId] | Event detail | Yes | All |
| /cohorts | Cohort list | Yes | company, professional |
| /cohorts/[cohortId] | Cohort detail | Yes | company, professional |
| /assignments | Assignment list | Yes | All |
| /reports | Report list | Yes | All |
| /reports/[reportId] | Report detail | Yes | All |
| /notifications | Notifications | Yes | All |
| /settings | Settings | Yes | All |
| /admin/users | User management | Yes | superadmin |
| /admin/programs | Platform programs | Yes | superadmin |
| /admin/tools | Platform tools | Yes | superadmin |
| /widget/[toolId] | Embeddable widget | No | Public |

**Route conventions:**
- Route group `(app)` wraps all authenticated routes — shares one app shell layout
- `layout.tsx` at `(app)` level handles auth guarding for all child routes
- Dynamic routes use `[param]` naming
- All route paths exported as typed constants from `src/constants/routes.ts`
- Local dev: use `NEXT_PUBLIC_STUDIO_TYPE` to test a specific Studio landing page
  since domain rewrites only work on deployed Vercel environments

**Acceptance Criteria:**
- All route files created as placeholder `page.tsx` files
- `next.config.js` domain rewrite rules implemented for all three Studio domains
- Route constants defined in `src/constants/routes.ts`
- Domain rewrites tested and confirmed working on Vercel staging
- Local dev can access each Studio landing page via `/coaching-studio`,
  `/training-studio`, `/recruitment-studio` paths directly
- No 404 errors on any defined route

---

### US-T2-04 — Component Structure + Module Pattern
**Status:** 🔲 Not Started

**Description:**
Define the component architecture and module pattern that all feature development must follow.

**Module structure (per feature module):**

```text
src/modules/[module-name]/
├── components/ # UI components for this module
│ ├── [ComponentName].tsx
│ └── index.ts # Barrel export
├── hooks/ # Module-specific hooks
│ └── use[ModuleName].ts
├── types/ # Module-specific types
│ └── [module].types.ts
├── utils/ # Module-specific utilities
└── index.ts # Public API of the module
```

**Component rules:**
- Components are function components only (no class components)
- Each component file exports one primary component as default
- Props interfaces are defined in the same file as the component
- No direct Firestore calls from components — all data via service layer
- No business logic in components — logic belongs in hooks or Functions
- Shared UI primitives use `shadcn/ui` components
- Custom components extend `shadcn/ui` — never replace them

**Naming conventions:**
- Component files: `PascalCase.tsx`
- Hook files: `useCamelCase.ts`
- Service files: `camelCase.service.ts`
- Type files: `camelCase.types.ts`
- Utility files: `camelCase.ts`

**Acceptance Criteria:**
- Module structure documented in CONTRIBUTING.md
- At least one example module created following the pattern (e.g. `src/modules/app-shell/`)
- All existing code refactored to follow the pattern
- No components with direct Firestore imports

---

### US-T2-05 — State Management (Zustand Stores)
**Status:** 🔲 Not Started

**Description:**
Implement the global Zustand stores used across the StudioVerse application.

**Stores to create:**

**1. Auth Store (`src/stores/auth.store.ts`)**
```typescript
interface AuthStore {
  user: FirebaseUser | null
  userProfile: UserProfile | null
  userContext: UserContext | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: FirebaseUser | null) => void
  setUserProfile: (profile: UserProfile | null) => void
  setUserContext: (context: UserContext | null) => void
}
```

**2. Studio Store (`src/stores/studio.store.ts`)**
```typescript
interface StudioStore {
  studioType: StudioType
  config: StudioConfig
  terminology: TerminologyMap
}
```

**3. Notifications Store (`src/stores/notifications.store.ts`)**
```typescript
interface NotificationsStore {
  notifications: Notification[]
  unreadCount: number
  isOpen: boolean
  setNotifications: (n: Notification[]) => void
  markRead: (id: string) => void
  toggleOpen: () => void
}
```

**Rules:**
- Stores are initialised from server state or Firebase auth listener — not from local storage
- No sensitive data in stores beyond what Firebase Auth already holds
- Stores are reset on logout

**Acceptance Criteria:**
- All three stores created in `src/stores/`
- Stores are typed with TypeScript interfaces
- Auth store initialised on Firebase `onAuthStateChanged`
- `npm run build` succeeds with stores in place

---

### US-T2-06 — API / Service Layer Setup
**Status:** 🔲 Not Started

**Description:**
Create the service layer that mediates all Firestore reads and writes. No component or hook may access Firestore directly — all data access must go through a service function.

**Service layer rules:**
- Service files live in `src/services/`
- Each service function is async and returns typed data
- All service functions accept `studioType` as a required parameter for tenant scoping
- Service functions never throw raw Firestore errors — they catch, log, and rethrow with a typed `ServiceError`
- No Firebase SDK imports outside of `src/lib/firebase.ts` and `src/services/`

**Example service pattern:**
```typescript
// src/services/programs.service.ts
export async function getPrograms(studioType: StudioType): Promise<Program[]> {
  try {
    const q = query(
      collection(db, 'programs'),
      where('studioType', '==', studioType),
      where('status', '==', 'published')
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program))
  } catch (error) {
    logger.error('getPrograms failed', error as Error, { studioType })
    throw new ServiceError('Failed to load programs', error)
  }
}
```

**Services to create as stubs:**
- `users.service.ts`
- `userContexts.service.ts`
- `companies.service.ts`
- `programs.service.ts`
- `tools.service.ts`
- `assignments.service.ts`
- `cohorts.service.ts`
- `reports.service.ts`
- `events.service.ts`
- `notifications.service.ts`

**Acceptance Criteria:**
- All service stub files created in `src/services/`
- Service pattern documented with example
- `ServiceError` class created in `src/utils/`
- No Firestore imports outside `src/lib/firebase.ts` and `src/services/`

---

### US-T2-07 — Constants + Enums
**Status:** 🔲 Not Started

**Description:**
Define all platform-wide constants and enumerations used across the StudioVerse codebase.

**Files to create:**

**`src/constants/roles.ts`**
```typescript
export const ROLES = {
  SUPER_ADMIN: 'superadmin',
  COMPANY: 'company',
  PROFESSIONAL: 'professional',
  INDIVIDUAL: 'individual',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]
```

**`src/constants/studio.ts`**
```typescript
export const STUDIO_TYPES = {
  COACHING: 'coaching',
  TRAINING: 'training',
  RECRUITMENT: 'recruitment',
} as const

export type StudioType = typeof STUDIO_TYPES[keyof typeof STUDIO_TYPES]
```

**`src/constants/routes.ts`**
```typescript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROGRAMS: '/programs',
  TOOLS: '/tools',
  EVENTS: '/events',
  COHORTS: '/cohorts',
  ASSIGNMENTS: '/assignments',
  REPORTS: '/reports',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  ADMIN: {
    USERS: '/admin/users',
    PROGRAMS: '/admin/programs',
    TOOLS: '/admin/tools',
  },
} as const
```

**`src/constants/site.ts`**
- Platform name per studio type
- Default counter values for landing page
- Support email addresses

**Acceptance Criteria:**
- All constant files created and exported correctly
- Constants used across codebase instead of inline string literals
- TypeScript enums or `as const` objects used consistently
- No magic strings in application code

---

### US-T2-08 — Utilities + Helpers
**Status:** 🔲 Not Started

**Description:**
Create the shared utility functions used across the StudioVerse codebase.

**Utilities to create:**

**`src/utils/cn.ts`** — Tailwind class merge utility
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**`src/utils/date.ts`**
- `formatDate(date: Timestamp | Date, format?: string): string`
- `isOverdue(dueDate: Timestamp): boolean`
- `getDaysUntilDue(dueDate: Timestamp): number`
- `toFirestoreTimestamp(date: Date): Timestamp`

**`src/utils/format.ts`**
- `formatName(name: string): string` — capitalise correctly
- `truncate(text: string, maxLength: number): string`
- `pluralise(word: string, count: number, plural?: string): string`

**`src/utils/validation.ts`**
- Common Zod schemas for reuse across forms
- `emailSchema`, `nameSchema`, `urlSchema`, `phoneSchema`

**`src/utils/storage.ts`**
- `uploadAvatar(userId: string, file: File): Promise<string>`
- `uploadProgramAsset(programId: string, moduleId: string, file: File): Promise<string>`
- `getDownloadUrl(path: string): Promise<string>`

**Acceptance Criteria:**
- All utility files created in `src/utils/`
- `cn()` utility available and used in all component class props
- Date utilities handle Firestore Timestamps correctly
- All utilities are fully typed

---

### US-T2-09 — Error Handling (error.tsx + Boundaries)
**Status:** 🔲 Not Started

**Description:**
Implement centralised error handling for both the frontend application and the service layer.

**Error handling layers:**

**1. Route-level error boundaries (Next.js App Router)**
- `src/app/error.tsx` — global error boundary
- `src/app/(app)/error.tsx` — app shell error boundary
- Each must display a user-friendly error message with a retry option

**2. Service layer errors**
```typescript
// src/utils/errors.ts
export class ServiceError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
    public code?: string
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export class AuthError extends Error { ... }
export class PermissionError extends Error { ... }
export class NotFoundError extends Error { ... }
```

**3. Global unhandled error handler**
- `window.onerror` and `window.onunhandledrejection` captured in root layout
- Errors sent to logger / monitoring provider

**Error display principles:**
- Never show raw Firebase or Firestore error messages to users
- Always show a human-readable message
- Always provide a recovery action (retry, go home, contact support)
- Loading, empty, and error states handled for every data-fetching component

**Acceptance Criteria:**
- `src/app/error.tsx` exists and renders correctly
- `src/app/(app)/error.tsx` exists and renders correctly
- `ServiceError` and other typed errors defined in `src/utils/errors.ts`
- No raw Firebase error messages shown to users in any state

---

### US-T2-10 — Form Handling Pattern
**Status:** 🔲 Not Started

**Description:**
Establish the standard form handling pattern using `react-hook-form` and `zod` that all forms across StudioVerse must follow.

**Pattern:**
```typescript
// Standard form pattern
const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
})

type FormData = z.infer<typeof schema>

const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: { email: '', name: '' },
})
```

**Form component conventions:**
- All form fields use `shadcn/ui` Form, FormField, FormItem, FormLabel, FormMessage components
- Validation schemas defined with Zod
- Form submission calls a service function — never Firestore directly
- Submission state (loading, success, error) handled with form state
- All form errors displayed inline using `FormMessage`
- Submit buttons disabled during submission

**Shared form components to create:**
- `FormInput` — text input with label + error
- `FormSelect` — dropdown select
- `FormTextarea` — multiline text
- `FormFileUpload` — file upload with preview
- `FormSubmitButton` — button with loading state

**Acceptance Criteria:**
- Form pattern documented with example
- Shared form components created in `src/modules/app-shell/components/form/`
- At least one working form example (e.g. login form shell) follows the pattern
- Form validation errors display correctly

---

### US-T2-11 — Studio Landing Page Content Config
**Status:** 🔲 Not Started

**Description:**
Create the content configuration files for each Studio's landing page.
Each Studio directory has its own `content.config.ts` that supplies all
copy, counters, benefit cards, SEO metadata, and social links to the
shared marketing components.

**Files to create:**
- `src/modules/marketing/coaching-studio/content.config.ts`
- `src/modules/marketing/training-studio/content.config.ts`
- `src/modules/marketing/recruitment-studio/content.config.ts`

**Each content config must export:**

```typescript
export const studioContent = {
  meta: {
    title: string,
    description: string,
    ogImage: string,
    keywords: string[],
  },
  hero: {
    eyebrow: string,
    headline: string,
    subtext: string,
    primaryCTA: string,
    secondaryCTA: string,
  },
  counters: [
    { label: string, value: number }
  ],
  coachBenefits: BenefitCard[],
  individualBenefits: BenefitCard[],
  programs: SampleCard[],
  tools: SampleCard[],
  events: SampleCard[],
  footer: {
    companyName: string,
    address: string,
    email: string,
    phone: string,
    whatsapp: string,
    instagram: string,
    linkedin: string,
  },
}
```

**Why this is separate from `studio.config.ts`:**
- `studio.config.ts` drives the authenticated app shell (terminology, RBAC labels)
- `content.config.ts` drives the public landing page (copy, SEO, marketing content)
- They are intentionally separate — landing page editors should never need to
  touch app shell config and vice versa

**Acceptance Criteria:**
- All three `content.config.ts` files created with correct TypeScript types
- Shared marketing components accept content config as props — no hardcoded copy
- Each Studio landing page passes its own config to shared components
- Changing copy requires only editing the config file — no component changes needed

---

## EPIC T3 — Deployment & DevOps
**Priority:** P0 | **Status:** 🔄 PARTIAL (T3-01 and T3-02 Done)
**Goal:** Establish the full deployment infrastructure, CI/CD pipeline, and environment management for all three StudioVerse Studio deployments.

---

### US-T3-01 — Setup Vercel Projects (3 Studios)
**Status:** ✅ Done

**Description:**
Create three separate Vercel projects — one per Studio type — all connected to the same `studioverse` GitHub repository.

**Vercel projects:**
- `studioverse-coaching` → coachingstudio.io (or chosen domain)
- `studioverse-training` → trainingstudio.io (or chosen domain)
- `studioverse-recruitment` → recruitmentstudio.io (or chosen domain)

**Per project, configure:**
- Framework preset: Next.js
- Root directory: `/` (monorepo root)
- Build command: `npm run build`
- Output directory: `.next`
- `NEXT_PUBLIC_STUDIO_TYPE` set to the relevant Studio type in Vercel environment variables

**Acceptance Criteria:**
- Three Vercel projects created and connected to GitHub
- Hello World deploy confirmed on all three projects ✅
- `NEXT_PUBLIC_STUDIO_TYPE` set correctly per project

---

### US-T3-02 — Connect GitHub Repo to Vercel
**Status:** ✅ Done

**Description:**
Connect the `studioverse` GitHub repository to all three Vercel projects with automatic deployment on branch push.

**Branch-to-environment mapping (per Vercel project):**
- `main` branch → Production deployment
- `staging` branch → Preview/Staging deployment
- `dev` branch → Development preview deployment
- Feature branches → PR preview deployments (auto)

**Acceptance Criteria:**
- GitHub integration active on all three Vercel projects ✅
- Push to `main` triggers production deploy on all three
- PR previews work correctly

---

### US-T3-03 — Environment Variables (dev/staging/prod)
**Status:** 🔲 Not Started

**Description:**
Configure all required environment variables in each Vercel project for each environment tier.

**Variables to configure per Vercel project:**

| Variable | dev | staging | prod |
|----------|-----|---------|------|
| `NEXT_PUBLIC_STUDIO_TYPE` | coaching/training/recruitment | same | same |
| | _NOTE: Used inside authenticated app shell only. Not used by landing pages._ | | |
| | _Each Vercel project still needs this set so the app shell knows which Studio context to activate after login._ | | |
| `NEXT_PUBLIC_APP_ENV` | dev | staging | prod |
| `NEXT_PUBLIC_APP_BASE_URL` | localhost:3000 | staging URL | prod URL |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | dev project key | staging key | prod key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | dev domain | staging domain | prod domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | studioverse-dev | studioverse-staging | studioverse-prod |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | dev bucket | staging bucket | prod bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | dev sender | staging sender | prod sender |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | dev app id | staging app id | prod app id |
| `NEXT_PUBLIC_ENABLE_MOCK_SESSION` | true | false | false |

**Acceptance Criteria:**
- All variables set in Vercel for all three projects across all environments
- Application reads correct Firebase project based on environment
- No secrets in `NEXT_PUBLIC_` variables
- `.env.example` updated to reflect all required keys

---

### US-T3-04 — Firebase Deploy Config
**Status:** 🔲 Not Started

**Description:**
Configure the Firebase deployment pipeline to deploy Functions, Firestore rules, Storage rules, and indexes to the correct Firebase project per environment.

**Deploy commands:**
```bash
# Deploy to dev
firebase use dev && firebase deploy

# Deploy functions only to staging
firebase use staging && firebase deploy --only functions

# Deploy rules only to prod
firebase use default && firebase deploy --only firestore:rules,storage
```

**`firebase.json` targets:**
- `firestore.rules` → `firestore.rules`
- `firestore.indexes` → `firestore.indexes.json`
- `storage.rules` → `storage.rules`
- `functions` → `functions/`

**Acceptance Criteria:**
- `firebase deploy` succeeds for all targets on dev project
- Deploy commands documented in README
- Separate deploy commands documented for rules-only, functions-only, and full deploys

---

### US-T3-05 — CI/CD Pipeline (GitHub Actions)
**Status:** 🔲 Not Started

**Description:**
Implement automated CI/CD workflows using GitHub Actions to enforce code quality and automate deployments.

**Workflows to create:**

**1. `ci.yml` — runs on every PR to `dev`, `staging`, `main`**
- Checkout code
- Install dependencies
- Run TypeScript type check (`tsc --noEmit`)
- Run ESLint
- Run build (`npm run build`)
- Fail PR if any step fails

**2. `deploy-functions.yml` — runs on merge to `main`**
- Deploy Firebase Functions to production
- Notify on success/failure

**3. `deploy-rules.yml` — runs on merge to `main`**
- Deploy Firestore and Storage rules to production

**Acceptance Criteria:**
- `ci.yml` workflow runs on all PRs and blocks merge on failure
- TypeScript errors block merge
- ESLint errors block merge
- Build failure blocks merge
- Functions and rules deploy automatically on merge to `main`

---

### US-T3-06 — Multi-environment Setup
**Status:** 🔲 Not Started

**Description:**
Validate and document the complete three-environment setup (dev, staging, prod) for both Vercel and Firebase.

**Environment matrix:**

| Environment | Vercel Deploy | Firebase Project | Branch | Purpose |
|-------------|--------------|-----------------|--------|---------|
| dev | Preview URL | studioverse-dev | dev | Local and feature dev |
| staging | Staging URL | studioverse-staging | staging | QA and stakeholder review |
| prod | Production URL | studioverse-prod | main | Live users |

**Validation checklist:**
- App connects to correct Firebase project in each environment
- `NEXT_PUBLIC_APP_ENV` reads correctly in each environment
- Auth tokens from dev Firebase do not work on prod Firebase (isolation confirmed)
- Storage buckets are isolated per environment

**Acceptance Criteria:**
- All three environments independently operational
- Environment isolation confirmed (dev data cannot bleed to prod)
- Environment matrix documented in README

---

### US-T3-07 — Domain Mapping (3 Studio Domains)
**Status:** 🔲 Not Started

**Description:**
Configure custom domain names for each Studio's production Vercel deployment.

**Domains to configure:**
- Coaching Studio: `coachingstudio.io` (or confirmed brand domain)
- Training Studio: `trainingstudio.io` (or confirmed brand domain)
- Recruitment Studio: `recruitmentstudio.io` (or confirmed brand domain)

**DNS configuration:**
- Add Vercel's DNS records (A record or CNAME) to domain registrar
- `www` to apex redirect configured
- Canonical domain enforced (apex or www — choose one consistently)

**Acceptance Criteria:**
- All three production domains resolve to correct Vercel deployments
- HTTPS active on all three domains
- www redirects to apex (or vice versa) consistently
- Each Studio domain shows the correct Studio-type content driven by `NEXT_PUBLIC_STUDIO_TYPE`
- `next.config.js` domain rewrite rules (defined in US-T2-03) must be in place BEFORE domain
  mapping is tested — domain mapping alone is not sufficient without the rewrites

---

### US-T3-08 — SSL Configuration
**Status:** 🔲 Not Started

**Description:**
Confirm SSL certificates are active and auto-renewing on all three Studio domains.

**Note:** Vercel auto-provisions Let's Encrypt SSL certificates on custom domain configuration. This story is a validation and confirmation story, not a manual implementation story.

**Checklist:**
- SSL certificate active on all three production domains
- Certificate auto-renewal confirmed (Vercel managed)
- HTTP to HTTPS redirect active
- No mixed-content warnings on any page

**Acceptance Criteria:**
- All three domains serve HTTPS only
- No browser SSL warnings on any domain
- Certificate expiry dates confirmed and auto-renewal active

---

### US-T3-09 — Build Validation
**Status:** 🔲 Not Started

**Description:**
Confirm that the production build process is clean, reproducible, and produces a correct output for all three Studio types.

**Build validation steps:**
1. Set `NEXT_PUBLIC_STUDIO_TYPE=coaching` → run `npm run build` → confirm success
2. Set `NEXT_PUBLIC_STUDIO_TYPE=training` → run `npm run build` → confirm success
3. Set `NEXT_PUBLIC_STUDIO_TYPE=recruitment` → run `npm run build` → confirm success
4. Confirm no TypeScript errors in any Studio build
5. Confirm no ESLint errors in any Studio build
6. Confirm build output size is within acceptable range

**Build scripts in `package.json`:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "build:coaching": "NEXT_PUBLIC_STUDIO_TYPE=coaching next build",
    "build:training": "NEXT_PUBLIC_STUDIO_TYPE=training next build",
    "build:recruitment": "NEXT_PUBLIC_STUDIO_TYPE=recruitment next build"
  }
}
```

**Acceptance Criteria:**
- All three Studio builds succeed without errors
- Build output validated on each Vercel project
- Build scripts documented in README

---

### US-T3-10 — Rollback Strategy
**Status:** 🔲 Not Started

**Description:**
Document and validate the rollback procedures for both Vercel frontend and Firebase backend in the event of a bad production deployment.

**Vercel rollback:**
- Vercel retains deployment history per project
- Rollback = promote a previous deployment to production via Vercel dashboard or CLI
- Command: `vercel rollback [deployment-url] --scope [team]`
- All three Studio projects can be rolled back independently

**Firebase Functions rollback:**
- Firebase does not have built-in rollback — rollback is achieved by redeploying a previous version
- Previous versions are available via Git tags on `main`
- Rollback procedure: `git checkout [previous-tag]` → `firebase deploy --only functions`

**Firestore rules rollback:**
- Rules are version-controlled in Git
- Rollback: `git checkout [previous-version] -- firestore.rules` → `firebase deploy --only firestore:rules`

**Rollback runbook:**
1. Identify the bad deployment (Vercel dashboard or Firebase console)
2. For Vercel: use dashboard to promote previous deployment
3. For Functions: `git checkout [previous-tag]` → `firebase deploy --only functions`
4. For Rules: `git checkout [previous-version] -- firestore.rules` → `firebase deploy --only firestore:rules`
5. Verify rollback by testing critical user flows
6. Create incident post-mortem

**Acceptance Criteria:**
- Rollback procedures documented in RUNBOOK.md or README
- Vercel rollback tested on staging at least once
- Firebase Functions rollback procedure tested on dev at least once

---

## EPIC T4 — Security & Access Control
**Priority:** P0 | **Status:** 🔲 NOT STARTED
**Goal:** Implement the complete security baseline including RBAC, Firestore rules for all 25 collections, data isolation, input validation, audit logging, and PII handling that every functional epic depends on.

---

### US-T4-01 — Define Roles (superadmin/company/professional/individual)
**Status:** 🔲 Not Started

**Description:**
Formally implement the four-role model across the StudioVerse codebase. The role model is defined in the Technical Architecture and Database Specification — this story implements it in code.

**Four roles:**

| Role | Label (Coaching) | Label (Training) | Label (Recruitment) | Access Level |
|------|-----------------|-----------------|---------------------|-------------|
| superadmin | Portal Admin | Portal Admin | Portal Admin | Full platform access |
| company | Coaching Firm | Training Company | Recruitment Agency | Organisation-scoped access |
| professional | Coach | Trainer | Recruiter | Own individuals + cohorts |
| individual | Coachee | Learner | Candidate | Own data only |

**Implementation:**
- Roles stored in `users.roles` array (string[]) in Firestore
- `userContexts` document is the RBAC oracle — precomputed by `buildUserContext` Function
- `useUserContext()` hook exposes role data to components
- Role constants defined in `src/constants/roles.ts`
- Role type exported as TypeScript union type

**Multi-role support:**
- A user may hold multiple roles (e.g. `[professional, individual]`)
- Access rules are additive — user gets the union of permissions across all their roles
- SuperAdmin always overrides all other role restrictions

**Acceptance Criteria:**
- Role constants defined in `src/constants/roles.ts`
- Role type exported as TypeScript type
- `userContexts` schema implemented in Firestore
- `buildUserContext` Firebase Function creates correct `userContexts` document on user creation

---

### US-T4-02 — Auth Guards (Route Protection)
**Status:** 🔲 Not Started

**Description:**
Implement route-level authentication and authorisation guards using Next.js App Router middleware and layout-level checks.

**Two-layer guard strategy:**

**Layer 1: Middleware (`src/middleware.ts`)**
- Checks Firebase Auth session cookie on every request to `(app)` routes
- Redirects unauthenticated users to `/login`
- Does not check roles — only checks authentication

**Layer 2: Layout-level role check (`src/app/(app)/layout.tsx`)**
- Reads `userContext` from Firestore on load
- Redirects user to their role-appropriate dashboard if accessing wrong area
- Example: a `individual` user accessing `/admin/users` is redirected to `/dashboard/individual`

**Client-side guard hook:**
```typescript
// src/hooks/useRequireAuth.ts
export function useRequireAuth(requiredRoles?: Role[]) {
  const { userContext, isLoading } = useUserContext()
  // redirects if not authenticated or wrong role
}
```

**Protected route matrix:**
- `/admin/*` → superadmin only
- `/cohorts/*` → company, professional only
- `/reports/*` → all authenticated, but data filtered by role
- `/dashboard/admin` → superadmin only
- All other `/dashboard/*` → role-specific

**Acceptance Criteria:**
- Unauthenticated users accessing any `(app)` route are redirected to `/login`
- Users accessing role-restricted routes are redirected to their own dashboard
- Auth guard logic is not duplicated in individual page components
- Guards work correctly on both web and mobile (Capacitor) builds

---

### US-T4-03 — Firestore Security Rules (All 25 Collections)
**Status:** 🔲 Not Started

**Description:**
Implement the complete Firestore security rules for all 25 collections defined in the StudioVerse Database Specification v2.

**Rules must enforce:**
- Authentication required on all reads and writes
- `studioType` field must match between document and requesting user
- Role-based access per collection
- Data ownership — users can only read/write their own data unless elevated role

**Key rules per collection:**

**users:**
- Read own document: authenticated + `request.auth.uid == resource.data.id`
- Write own document: authenticated + `request.auth.uid == resource.data.id`
- Read any user: superadmin only
- Create: authenticated (own document only)

**userContexts:**
- Read own: authenticated + `request.auth.uid == resource.data.userId`
- Write: Functions only (no client writes)

**programs:**
- Read published: any authenticated user with matching `studioType`
- Write: superadmin or professional (own programs only)

**tools:**
- Read published: any authenticated user with matching `studioType`
- Write: superadmin or professional (own tools only)

**assignments:**
- Read: superadmin, owning professional, or assigned individual
- Write: superadmin or professional only

**reports:**
- Read: superadmin, owning professional (own individuals only), or individual (own reports only)
- Write: Functions only (no client writes)

**auditLogs:**
- Read: superadmin only
- Write: Functions only

**toolSubmissions:**
- Read: superadmin, owning professional, or submitting individual
- Write: submitting individual only (and only while status is `in_progress`)

**Acceptance Criteria:**
- `firestore.rules` file implements rules for all 25 collections
- Rules deployed to dev Firebase project
- Firebase emulator rule tests written for critical read/write paths
- No collection accessible without authentication
- No user can read another user's private data

---

### US-T4-04 — Data Isolation (studioType + professionalId Scoping)
**Status:** 🔲 Not Started

**Description:**
Implement and validate the multi-tenancy data isolation model at both the application layer and the Firestore rules layer.

**Isolation model:**

**Level 1: Studio Tenant Isolation**
- Every document in every tenant collection carries `studioType`
- All queries include `where('studioType', '==', studioType)` as the first filter
- The `studioType` value comes from `useStudio()` — never from user input
- A user registered as `coaching` studioType cannot see `training` data even if they query directly

**Level 2: Professional Scoping**
- An Individual's data is always linked to their Professional via `professionalId`
- A Professional can only query Individuals where `professionalId == their userId`
- A Company can only query Professionals where `companyId == their companyId`

**Level 3: SuperAdmin Override**
- SuperAdmin can read all documents within their Studio type
- SuperAdmin cannot cross Studio types without a separate account

**Service layer enforcement:**
- Every service function that returns a list must include `studioType` filter
- `studioType` is never sourced from URL params or user input — always from `useStudio()` config
- Professional-scoped services always include `professionalId` filter

**Acceptance Criteria:**
- `studioType` filter applied in all service layer list queries
- `professionalId` filter applied in all individual-scoped queries
- Firestore rules enforce isolation at database layer independently of application layer
- Manual test: user from coaching Studio cannot retrieve training Studio data

---

### US-T4-05 — Secure Firebase Functions (Input Validation)
**Status:** 🔲 Not Started

**Description:**
Implement security hardening for all Firebase Functions including authentication verification, input validation, and rate limiting.

**Every callable Function must:**
1. Verify `context.auth` exists — reject unauthenticated calls with `unauthenticated` error
2. Verify the caller's role from `userContexts` — reject unauthorised calls with `permission-denied`
3. Validate all input data using Zod schemas — reject invalid input with `invalid-argument`
4. Validate `studioType` in the request matches the caller's `studioType`
5. Log the call with actor ID, studio type, function name, and timestamp
6. Catch all errors and return typed error responses

**Function security wrapper pattern:**
```typescript
async function secureFunctionCall<T>(
  context: CallableContext,
  input: unknown,
  schema: ZodSchema<T>,
  requiredRoles: Role[],
  handler: (data: T, context: CallableContext) => Promise<unknown>
) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required')
  const validated = schema.safeParse(input)
  if (!validated.success) throw new functions.https.HttpsError('invalid-argument', 'Invalid input')
  // role check, then execute handler
}
```

**Acceptance Criteria:**
- All Firebase Functions use authentication verification
- All Functions validate input with Zod schemas
- Invalid or unauthenticated calls return typed error responses
- Functions never expose raw error messages to callers

---

### US-T4-06 — Input Validation Layer
**Status:** 🔲 Not Started

**Description:**
Implement a consistent input validation layer across both the frontend (forms) and backend (Functions) to prevent invalid or malicious data from entering the system.

**Frontend validation:**
- All forms use Zod schemas via `react-hook-form` + `zodResolver`
- Validation runs client-side before any service call
- Client-side validation is UX — it does not replace server-side validation

**Backend validation:**
- All Firebase Functions re-validate input with Zod schemas independently of frontend validation
- Server-side validation is the authoritative gate
- Common validation schemas live in `functions/src/utils/validation.ts` and are shared with frontend via a `shared/` package if monorepo permits, or duplicated deliberately

**Input sanitisation:**
- All string inputs are trimmed before storage
- No HTML or script content accepted in text fields
- File upload type and size validated before Storage upload

**Acceptance Criteria:**
- All form inputs validated with Zod on frontend
- All Function inputs validated with Zod on backend
- No user-submitted data stored without validation
- File upload size limit enforced (max 50MB per file)

---

### US-T4-07 — Audit Logging (auditLogs Collection)
**Status:** 🔲 Not Started

**Description:**
Implement the immutable audit trail for all critical platform actions using the `auditLogs` Firestore collection.

**Events that must generate audit log entries:**

| Event | Actor | Details |
|-------|-------|---------|
| User created | System | userId, studioType, email |
| User approved | superadmin | targetUserId, approvedBy |
| User suspended | superadmin | targetUserId, suspendedBy, reason |
| Role changed | superadmin | targetUserId, oldRole, newRole |
| Assignment created | professional | assignmentId, individualId, resourceId |
| Tool submitted | individual | toolId, submissionId |
| Report generated | system | reportId, userId, toolId |
| Program published | professional/superadmin | programId |
| Tool published | professional/superadmin | toolId |

**`auditLogs` document schema:**
```typescript
{
  id: string,
  studioType: StudioType,
  actorId: string,
  actorRole: Role,
  action: string,
  targetId?: string,
  targetType?: string,
  metadata: Record<string, unknown>,
  createdAt: Timestamp,
  ipAddress?: string
}
```

**Rules:**
- Audit logs are written by Functions only — never by the UI
- Audit logs are never updated or deleted — append only
- SuperAdmin can read audit logs via the Admin Console

**Acceptance Criteria:**
- `auditLogs` collection rules enforce write-from-Functions-only
- All listed critical events generate audit log entries
- Audit logs are readable by SuperAdmin in the Admin Console
- No audit log document is ever modified after creation

---

### US-T4-08 — Rate Limiting on Functions
**Status:** 🔲 Not Started

**Description:**
Implement rate limiting on Firebase Functions to prevent abuse and protect platform resources.

**Rate limiting strategy:**
- Use Firestore-based rate limiting (simple and serverless-compatible)
- Track call counts per user per function per time window in a `rateLimits` subcollection
- Reject calls that exceed the limit with `resource-exhausted` error

**Limits:**
| Function | Limit |
|----------|-------|
| Tool submission | 10 per hour per user |
| Report generation | 5 per hour per user |
| Email send | 20 per hour per user |
| Widget session create | 100 per hour per IP |

**Acceptance Criteria:**
- Rate limiting logic implemented for all high-risk Functions
- Exceeded rate limit returns `resource-exhausted` error
- Rate limit counters reset after the time window expires
- Rate limits documented in Technical Architecture

---

### US-T4-09 — Secure Env Vars (No Secrets in Frontend)
**Status:** 🔲 Not Started

**Description:**
Audit and validate that no secret values are present in the frontend bundle or any committed code.

**Audit checklist:**
- `GROQ_API_KEY` — must only exist in Firebase Functions environment
- `RESEND_API_KEY` — must only exist in Firebase Functions environment
- `FIREBASE_SERVICE_ACCOUNT_KEY` — must only exist in Firebase Functions environment
- `STRIPE_SECRET_KEY` — must only exist in server environment (Post-MVP)
- All `NEXT_PUBLIC_` variables are reviewed to confirm they contain no secrets
- `.env.local` confirmed in `.gitignore`
- Git history scanned for any accidentally committed secrets

**Tools:**
- `git-secrets` or `truffleHog` for scanning Git history
- Vercel environment variable audit for correct scope (preview/production/all)

**Acceptance Criteria:**
- No secrets found in any `NEXT_PUBLIC_` variable
- No secrets found in any committed file
- Git history scanned clean
- All secrets confirmed to live in Firebase Functions config or Vercel server-only env

---

### US-T4-10 — PII Handling Policy
**Status:** 🔲 Not Started

**Description:**
Define and implement the platform's approach to handling Personally Identifiable Information (PII) in compliance with basic data privacy principles.

**PII fields in StudioVerse:**
- Name, email, phone, avatar URL — in `users` collection
- Assessment responses — in `toolSubmissions` collection
- Report content — in `reports` collection and Firebase Storage

**PII handling rules:**
- PII is never logged in plain text in application logs or Functions logs
- Audit log entries reference user IDs, not user names or emails
- Reports stored in Firebase Storage are access-controlled (signed URLs or role-checked access)
- User data deletion: when a user is archived, PII fields (name, email, phone) are anonymised; report files in Firebase Storage may be retained per the business data-retention policy or deleted on request
- No PII is stored in Firebase Functions logs or application logs
- Data export: users may request an export of their own data (GDPR Article 20)

**Acceptance Criteria:**
- No PII appears in application logs or Functions logs
- Audit log entries use user IDs, not names or email addresses
- Reports in Firebase Storage are access-controlled (no public URLs)
- User data anonymisation/deletion process documented and implemented in Functions
- Data export mechanism documented (even if not yet implemented)

---

## EPIC T5 — Studio Config Architecture
**Priority:** P0 | **Status:** 🔲 NOT STARTED
**Goal:** Define and implement the per-Studio configuration system that controls terminology, feature flags, branding, and behaviour across Coaching Studio, Training Studio, and Recruitment Studio.

> **Note:** Story content for this Epic (US-T5-01 through US-T5-07) is pending and has not yet been added to this document. The Status Summary above reflects 7 planned stories.