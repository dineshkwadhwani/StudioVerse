# StudioVerse — Technical Architecture v2.0 — Part 2 of 2
## Sections 9 through 17

## Section 9 — Data Layer Integration

Service Layer Rules — all frontend access through src/services/:
- Maps 1:1 with Firestore collections
- Calls Firebase Callable Functions for all write operations
- Uses Firestore listeners only for real-time non-sensitive displays
- Returns fully typed responses
- Handles loading, error, and empty states

Data Access Patterns:
- Callable Function → all writes, sensitive reads, business logic
- onSnapshot listener → real-time UI (notifications, assignment status)
- getDoc → one-time data fetches (program detail, tool questions)
- Paginated query → all list views
- Denormalized fields → read-heavy display data

Required Indexes:
- assignments: (userId, status), (assignedBy, status), (cohortId, status)
- cohortMembers: (cohortId), (userId)
- toolResults: (userId, toolId), (userId, createdAt)
- professionalRelations: (professionalId, status)
- programs: (studioType, status, isFree)

## Section 10 — Security Architecture

Three overlapping security layers:
1. Firebase Auth — every request requires valid session token
2. Firestore Security Rules — document-level ownership enforcement
3. Firebase Functions Validation — caller identity + input schema + scope check

Firestore Rules Principles:
- userContexts: readable only by owning userId; writable only by Functions
- assignments: readable by assigned user and assigning Professional; Functions-only write
- programs: readable by any authenticated user; Functions-only write

Secret Management:
- Firebase config keys → NEXT_PUBLIC_FIREBASE_* (safe for client)
- Groq API key → Firebase Functions environment config only
- Resend API key → Firebase Functions environment config only
- Stripe secret key → Firebase Functions environment config only

## Section 11 — End-to-End Data Flows

Login and Session Hydration:
1. Firebase Auth validates session
2. Fetch userContexts/{uid} from Firestore
3. Write to Zustand store
4. App shell renders role-appropriate navigation
5. Studio terminology loaded from studio.config.ts

Assign Program to Cohort:
1. Professional selects program + cohort → calls createAssignment Function
2. Function validates Professional owns cohortId
3. Fetch cohortMembers → expand to userIds
4. Batched Firestore writes (max 500 per batch)
5. Trigger sendEmail + sendPush per assignment
6. Return assignmentIds[] → UI shows success

Tool Submission to Report Delivery:
1. Individual completes assessment → submitTool Function
2. Create toolSubmission document
3. processToolResult: score → Groq prompt → narrative text
4. Format branded PDF → upload to Firebase Storage
5. Create report document with pdfUrl
6. sendEmail to Individual + Professional
7. Update assignment to completed

Program Progress Update:
1. Individual marks module complete → updateProgramProgress Function
2. Update programProgress document
3. Recalculate progressPercentage
4. If 100% → assignment completed + notify Professional
5. Drip check on next module

## Section 12 — CI/CD and Deployment

Frontend (Vercel):
- develop → studioverse-dev
- staging → studioverse-staging
- main → studioverse-prod (all three Studio deployments)

Backend (Firebase CLI):
firebase deploy --only functions --project studioverse-prod
firebase deploy --only firestore:rules --project studioverse-prod

Mobile (Capacitor):
1. next build
2. npx cap sync
3. npx cap open android
4. npx cap open ios
App ID: io.studioverse.app

Rollback:
- Frontend: instant via Vercel dashboard
- Functions: redeploy previous version via Firebase CLI
- Firestore: use auditLogs to reconstruct; migrations must be reversible

## Section 13 — Error Handling and Retry

Function-Level:
- Return typed error responses — never throw unhandled exceptions to client
- Distinguish user errors (invalid input) vs system errors (API timeout)
- Retry transient failures with exponential backoff — max 3 retries
- Log all errors: functionName, input, errorCode, errorMessage, userId

UI-Level:
- Every service call handles loading, error, and empty states
- No unhandled promise rejections
- User-facing messages are friendly — never expose raw error codes
- Route errors via Next.js error.tsx boundaries
- Unknown routes via not-found.tsx — never show blank screen

Capacitor Wrapper:
- Fatal startup errors show graceful error screen
- External links use Capacitor.openUrl() — not window.open()
- Soft keyboard events must not break form or nav layouts

## Section 14 — Logging and Monitoring

Function Logging Standard:
logger.info('functionName.start', { userId, input })
logger.info('functionName.success', { userId, output })
logger.error('functionName.error', { userId, error, input })

Audit Log Actions (written to auditLogs collection):
- User role change
- Professional approval / deactivation
- Assignment creation
- Report generation
- Payment processed
- userContext rebuild

Monitoring:
- Firebase console: Function invocations, error rates, execution times
- Vercel analytics: page load performance, traffic by Studio
- Firestore dashboard: read/write counts, storage, bandwidth
- Stripe dashboard: payment success, disputes, refunds
- Alert on: Function error rate > 1%, p95 execution time > 3s

## Section 15 — Cost and Scaling Strategy

Firestore Cost Controls:
- userContext reduces reads — no runtime joins across collections
- Batched writes for cohort expansion (max 500/batch)
- Never increment single counter documents — use aggregation Functions
- limit(20) on all list queries — no unbounded reads
- Denormalize read-heavy fields on assignment documents

Functions Cost Controls:
- onCall for user-triggered actions
- Use onDocumentWritten triggers sparingly
- Avoid Function chains longer than 2 hops
- Cache Groq report prompts for identical result profiles

Storage Cost Controls:
- Video via YouTube/Vimeo embed — zero storage cost at MVP
- PDF and audio in Firebase Storage with CDN delivery
- Report PDFs archived after 2 years

## Section 16 — Developer Workflow

Local Development Setup:
git clone https://github.com/[org]/studioverse.git
cd studioverse
npm install
cd functions && npm install && cd ..
cp .env.example .env.local
# Set NEXT_PUBLIC_STUDIO_TYPE=coaching
firebase emulators:start --project studioverse-dev
npm run dev

Story Workflow:
1. Pick user story from backlog
2. Create branch: feature/E{epic}-US{story}-short-description
3. Define types → create service → write Function → build UI → add route
4. Test with Firebase Emulator
5. Push → Vercel preview auto-deploys
6. Review → merge to develop → studioverse-dev
7. QA on staging → merge to main → production

Naming Conventions:
- Files: kebab-case (program.service.ts)
- Components: PascalCase (ProgramCard.tsx)
- Functions: camelCase (createAssignment)
- Firestore collections: camelCase plural (assignments, toolResults)
- Firestore fields: camelCase (assignedBy, createdAt)
- Env variables: SCREAMING_SNAKE_CASE (NEXT_PUBLIC_STUDIO_TYPE)
- Branches: feature/E{n}-US{n}-name

## Section 17 — Engineering Rules: Non-Negotiable

1. No direct Firestore calls from UI — all access through src/services/
2. All business logic in Firebase Functions — never in UI components
3. All external API calls (Groq, Resend, Stripe, FCM) from Functions only
4. No secrets in frontend code — only NEXT_PUBLIC_* safe variables
5. userContext drives all access decisions — never derive from raw role strings
6. Every Function is idempotent — same input always produces same result
7. Every Function logs input, output, and errors
8. No `any` in TypeScript — strict typing across all files
9. Modules are isolated — no cross-module imports except through services or types
10. All list queries are paginated — no unbounded Firestore reads
11. STUDIO_TYPE terminology never hardcoded in UI — always use useStudio() hook
12. All Studio-specific copy lives in studio config files — not in component JSX

---
END OF DOCUMENT
StudioVerse Technical Architecture v2.0
One codebase. Three Studios. Infinite extensibility.
Repository: github.com/[org]/studioverse
Confidential — Engineering Use Only