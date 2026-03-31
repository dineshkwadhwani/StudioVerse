# StudioVerse — Technical Architecture Engineering Specification
**Version 2.0 | March 2026 | Classification: Confidential — Engineering Use**

## Preamble
This document supersedes all previous versions of the CoachingStudio Technical Architecture Specification. It reflects the full architectural evolution of the platform to the StudioVerse model — a single-codebase, multi-tenant, configuration-driven SaaS engine that powers multiple independently branded Studio products.

## Section 1 — System Overview

### 1.1 What StudioVerse Is
StudioVerse is a multi-tenant SaaS platform that powers three externally branded Studio products from a single codebase:
- Coaching Studio — coachingstudio.io
- Training Studio — trainingstudio.io  
- Recruitment Studio — recruitmentstudio.io

Each Studio is a fully branded, independently deployed application differentiated by a single environment variable: NEXT_PUBLIC_STUDIO_TYPE.

### 1.2 Universal Actor Model
| Generic Role | Coaching Studio | Training Studio | Recruitment Studio |
|---|---|---|---|
| SuperAdmin | Platform Owner | Platform Owner | Platform Owner |
| Company | Coaching Firm | Training Company | Recruitment Agency |
| Professional | Coach | Trainer | Recruiter |
| Individual | Coachee | Learner | Candidate |

### 1.3 Core Architectural Principles
1. Studio-type tenancy — Tenant = Studio type. NEXT_PUBLIC_STUDIO_TYPE drives skin, terminology, catalog defaults.
2. Assignment-driven execution — Every resource delivered to an Individual is mediated through an Assignment entity.
3. userContext as RBAC oracle — Precomputed Firestore document is the single source of truth for access decisions.
4. No business logic in the UI — All logic lives in Firebase Functions.
5. No direct Firestore access from UI — Frontend communicates only through the service layer.
6. Strict data isolation — Professional A has zero visibility into Professional B's data.

## Section 2 — Studio Configuration Architecture

NEXT_PUBLIC_STUDIO_TYPE=coaching   → Coaching Studio (coachingstudio.io)
NEXT_PUBLIC_STUDIO_TYPE=training   → Training Studio (trainingstudio.io)
NEXT_PUBLIC_STUDIO_TYPE=recruitment → Recruitment Studio (recruitmentstudio.io)

What STUDIO_TYPE controls: Branding, Terminology, Landing Page copy, Dashboard labels, Default tool suite, Onboarding language, Navigation labels.

## Section 3 — Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI / Routing | Next.js App Router | All UI rendering, SSR/ISR, route structure |
| Type Safety | TypeScript | Type safety across all layers |
| UI System | Tailwind CSS + shadcn/ui | Design system, Studio theming |
| Client State | Zustand | userContext, session, UI state |
| Authentication | Firebase Auth | User identity, session tokens |
| Primary Database | Firestore | All application data |
| Business Logic | Firebase Functions | ALL mutations and logic |
| File Storage | Firebase Storage | Program media assets |
| Push Notifications | FCM | Mobile and web push |
| Email | Resend (via Functions only) | Transactional email |
| AI Reports | Groq API (via Functions only) | LLM report generation |
| Mobile Wrapper | Capacitor | iOS and Android packaging |
| Frontend Hosting | Vercel | Next.js deployment |
| Repository | GitHub — studioverse | Single monorepo |

Repository Identity:
- GitHub Repo: studioverse
- Firebase Projects: studioverse-dev | studioverse-staging | studioverse-prod
- Vercel Project: studioverse
- Capacitor App ID: io.studioverse.app

## Section 4 — Deployment Topology

Environments:
- develop branch → studioverse-dev
- staging branch → studioverse-staging  
- main branch → studioverse-prod

Multi-Studio Deployment — each Studio is a separate Vercel project pointing to the same repo:
- coaching-studio-prod → NEXT_PUBLIC_STUDIO_TYPE=coaching → coachingstudio.io
- training-studio-prod → NEXT_PUBLIC_STUDIO_TYPE=training → trainingstudio.io
- recruitment-studio-prod → NEXT_PUBLIC_STUDIO_TYPE=recruitment → recruitmentstudio.io

## Section 5 — Multi-Tenancy Architecture

Tenant = Studio Type (not Company). Shared-database, shared-schema model with logical isolation.

userContext document structure:
- userId, studioType, roles[]
- companyIds[], professionalIds[], myProfessionalId
- individualIds[], cohortIds[]
- isIndependent (true if Professional with no Company)
- updatedAt

Isolation Rules:
- SuperAdmin: full read across tenants, no cross-tenant write
- Company: sees all Professionals and Individuals in their companyId scope only
- Professional: sees own Individuals, cohorts, reports only — not other Professionals' data
- Individual: sees own profile, assignments, programs, reports only

## Section 6 — Codebase Module Structure

src/
  app/
    (public)/page.tsx          ← Studio landing page
    (app)/layout.tsx           ← App shell
    (app)/dashboard/page.tsx
    (app)/programs/page.tsx
    (app)/tools/page.tsx
    (app)/events/page.tsx
    (app)/cohorts/page.tsx
    (app)/assignments/page.tsx
    (app)/reports/page.tsx
    (app)/notifications/page.tsx
    (app)/settings/page.tsx
    (app)/admin/users/page.tsx
    widget/[toolId]/page.tsx   ← Embeddable widget (public)
  modules/
    app-shell/ | auth/ | users/ | programs/ | tools/
    assignments/ | cohorts/ | events/ | reports/ | notifications/
  services/
    user.service.ts | program.service.ts | tool.service.ts
    assignment.service.ts | cohort.service.ts | event.service.ts
    report.service.ts | notification.service.ts
  config/
    studio.config.ts
    studios/coaching.config.ts | training.config.ts | recruitment.config.ts
  store/
    user-context.store.ts | session.store.ts | ui.store.ts
  lib/
    firebase.client.ts | capacitor.ts | env.ts | helpers.ts
  types/
    user.types.ts | program.types.ts | tool.types.ts | assignment.types.ts
    cohort.types.ts | event.types.ts | report.types.ts
    studio.types.ts | userContext.types.ts
  constants/
    roles.ts | routes.ts | studio.constants.ts
  hooks/
    use-user-context.ts | use-studio.ts | use-mobile-nav.ts | use-current-role.ts

functions/src/
  assignments/ | tools/ | reports/ | context/
  notifications/ | auth/ | shared/

## Section 7 — Backend Architecture: Firebase Functions

Function Categories:
- Assignments: createAssignment, updateAssignment, reassignAssignment
- Tools: submitTool, processToolResult
- Reports: generateReport (Groq + PDF)
- Context: buildUserContext
- Notifications: sendEmail, sendPush
- Auth: onUserCreate, setUserRole, approveUser
- Cohorts: expandCohort, addCohortMember, removeCohortMember
- Payments: createCheckoutSession, handleStripeWebhook

Key Function Contracts:
createAssignment({ resourceType, resourceId, targetType, targetId, deadline, assignedBy }) → { assignmentIds[] }
submitTool({ toolId, answers }) → { submissionId }
processToolResult({ submissionId }) → { resultId, reportId }
buildUserContext({ userId }) → { userContext }
sendEmail({ to, templateId, data }) → { messageId }

## Section 8 — Core Engines

Assignment Engine:
1. Validate caller is Professional or SuperAdmin
2. Validate caller owns targetId
3. If cohort → fetch members → expand to userIds
4. For each userId: check duplicates → create assignment → trigger notification
5. Status lifecycle: assigned → in_progress → completed / overdue

Tool Engine:
1. Individual submits answers → submitTool Function
2. Validate attempt count vs retryAllowed
3. Create toolSubmission document
4. Score answers → store toolResult
5. Call Groq API → generate narrative
6. Format into branded PDF → store in Firebase Storage
7. Create report document with pdfUrl
8. Send dual delivery: email to Individual + Professional
9. Update assignment to completed

Program Engine:
1. Assignment created → Individual sees program in dashboard
2. Drip check: module.releaseAfterDays vs days since assignment
3. Individual marks module complete → programProgress updated
4. progressPercentage recalculated
5. On 100% → assignment completed + notification

Widget Engine:
1. Professional generates widget URL for toolId
2. Unique URL: /widget/{toolId}?ref={professionalId}
3. Anonymous user completes assessment on external site
4. Email capture → check if user exists → create account or link
5. Generate AI report → deliver to email
6. Platform receives new lead → Professional notified

---
PART 1 END — Sections 1 through 8
PART 2 covers: Data Layer, Security, Data Flows, CI/CD, Error Handling, Logging, Cost Strategy, Developer Workflow, Engineering Rules