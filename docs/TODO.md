# StudioVerse — Outstanding Work & Test Strategy

**Last updated:** May 3, 2026
**Status:** Journey Testing + Prod Push Planning
**Source:** Full codebase audit + security audit + OWASP audit + re-prioritization (May 2026 session).

---

## RECENTLY COMPLETED (May 2026 audit)

- ✅ SelectAndMove quiz runner — implemented as `GamifiedDragDropQuiz`
- ✅ AI question generation UI — fully wired in AssessmentsSection via `/api/assessments/generate-questions`
- ✅ Cash-out readiness data model — `CashoutRequestStatus`, `payoutProvider`, `payoutStatus` all implemented
- ✅ Buy Coins page — real Razorpay order + signature verification flow complete
- ✅ Bot rate limiting — `consumeRateLimit()` enforced on chat and retrieve routes
- ✅ Bot knowledge base caching — in-memory `chunkCacheByTenant` map in place
- ✅ Creator-owned Programs/Events — `ownershipScope` and `ownerEntityId` fields in types
- ✅ Audit fields and transaction traceability — `createdBy`, `reason`, `source`, timestamps on wallet and cashout records
- ✅ Security Vuln 1 fixed — Firestore `assignments` create rule now enforces `assignerId == auth.uid`
- ✅ Security Vuln 2 fixed — `saveCohort()` ownership check added before batch member delete
- ✅ Security Vuln 3 fixed — Bot hero requests Firestore rule now validates `tenantId == currentTenantId()`
- ✅ Security Vuln 4 fixed — `create-scoped` API re-validates professional's `associatedCompanyId` via admin SDK
- ✅ Notification service scaffolded — `notification.service.ts`, `notification-settings.service.ts`, templates JSON
- ✅ SuperAdmin dashboard overhauled — sections (Actions, Wallet, Users, Resources), tenant dropdown, 4 separate action tiles
- ✅ Role Responsibility Matrix — created as `docs/ROLE_RESPONSIBILITY_MATRIX.md` and `.pdf`
- ✅ Security Vuln 5 fixed — `/api/bot/guest-log` now validates incoming `tenantId` against the `tenants` collection before writing. Arbitrary tenant injection is no longer possible.
- ✅ Security Vuln 6 fixed — `referrals` create rule now enforces `isActorId(referrerUserId)` and `tenantId == currentTenantId()`. Attribution fraud and cross-tenant referral injection are no longer possible.
- ✅ Tenant activation checklist flow — each tenant now has a SuperAdmin checklist (`mail`, `wallet`, `bot`, `content published`), new tenants default to `inactive`, and activation is blocked until checklist completion.
- ✅ Notification audit logs enabled — `notificationLogs` collection is now explicitly supported with constrained Firestore rules, and managed-user welcome emails now write delivery outcomes for audit tracking.
- ✅ SuperAdmin Logs page — added under Actions menu with tabbed views for Guest Log, Notification Log, and Audit Log. Audit Log supports tenant/date/action-type filters and actor search; all log tabs use explicit Search actions.
- ✅ Tenant-configurable expiry reminders — Bot Hero, promotion, and listing expiry reminder windows are scheduler-backed and configurable per tenant in the Notifications settings section.
- ✅ Email notifications flow completion — activity assigned, assignment completed, cohort member added, approval granted/denied, referral invite, and referral joined confirmation to referrer are now wired.

---

## SECTION 1: PENDING DEVELOPMENT TASKS

### Security hardening (follow-through)

- ⏳ Convert OWASP findings into a per-release engineering checklist
- ⏳ Add automated security tests for high-risk paths (guest/public APIs, treasury-affecting callables, role-gated admin operations)
- ⏳ Add security regression verification in CI for authz boundary and protected collection write paths

---

## SECTION 2: JOURNEY TESTING (Active Focus)

### End-to-End Test Execution Plan

**See `testplan.pdf` in `/docs/` for full test automation strategy and breakdown of automatable vs. manual tests.**

#### Critical Path Tests (Run First)

1. **T1-Landing:** Page load, no errors → Pass
2. **T2-Register:** All 4 roles register, wallets created → Pass
3. **T3-Login:** Each role logs in, dashboard loads, correct menu → Pass
4. **T4-Profile:** Incomplete profile blocks assignment, completion unblocks → Pass
5. **T5-Wallet:** Debit on assignment, transaction logged → Pass
6. **T6-Assign:** Professional assigns Program to Individual, Activity in My Activities → Pass
7. **T7-Cohort:** Create cohort, bulk assign, all members receive activity → Pass
8. **T8-Referral:** Create referral → join → wallet credit → Pass
9. **T9-RBAC:** Each role sees only allowed menus, cannot bypass via URL → Pass
10. **T10-Reports:** SuperAdmin creates Assessment → Individual completes → Report generated → Pass

#### Quick Reference: Automatable vs Manual

**AUTOMATABLE (E2E Framework / API Tests):**

- ✅ Phase 1–3: Landing page load, registration, login for all 4 roles
- ✅ Phase 4–7: Profile completion, user creation, wallet initialisation and transactions
- ✅ Phase 8–9: Activity assignment workflows, My Activities visibility
- ✅ Phase 10: Assessment completion, report generation
- ✅ Phase 11: Cohort creation, bulk assignment calculations
- ✅ Phase 12: Referral creation, join flow, wallet rewards
- ✅ Phase 14–15: RBAC menu visibility, cross-tenant isolation, route access blocking
- ✅ Unit tests: All service layer functions (users, assignments, wallets, cohorts, assessments)

**NOT EASILY AUTOMATED (Manual/Visual Tests):**

- ❌ Visual responsive design (mobile/tablet/desktop)
- ❌ Email delivery verification
- ❌ Real payment/coin purchase flows
- ❌ Real SMS/OTP to actual phone numbers
- ❌ Video/media stream playback
- ❌ Bot intelligence quality evaluation
- ❌ UX quality and intuitiveness
- ❌ Colour contrast, accessibility compliance (partial automation with axe-core)
- ❌ Performance metrics under load

### Manual Testing Checklist

- [ ] **Browser Testing:** Chrome, Safari, Firefox (desktop + mobile viewports)
- [ ] **Mobile Responsiveness:** All flows on <600px viewport
- [ ] **Error Messages:** Clear messaging for edge cases
- [ ] **Session Persistence:** Refresh mid-journey, state retained
- [ ] **Performance:** Page load times, no freezes during assignment
- [ ] **Accessibility:** Keyboard navigation, colour contrast, screen reader compat

### Automation Framework

**Tools:** Playwright + TypeScript (with GitHub Actions CI/CD)

```
tests/
├── e2e/
│   ├── auth.spec.ts
│   ├── profile.spec.ts
│   ├── users.spec.ts
│   ├── content.spec.ts
│   ├── wallet.spec.ts
│   ├── cohorts.spec.ts
│   ├── referrals.spec.ts
│   └── rbac.spec.ts
├── api/
│   ├── users.test.ts
│   ├── assignments.test.ts
│   └── wallets.test.ts
└── unit/
    ├── services.test.ts
    └── utilities.test.ts
```

---

## SECTION 3: MEDIUM PRIORITY (Deferred — Post-Testing)

### Dashboard — Missing Tiles

- ✅ **Assignments Created / Completed tile** — `Activities (Complete / Assigned)` tile now live in RESOURCES section on SuperAdmin dashboard.
- ⏳ **Coin Requests in ACTIONS** — professional-to-company coin requests are not surfaced in the Actions section. Promotion, Cashout, Listing, Bot requests are shown — Coin Requests is missing.

### E8 — Assign Activity Menu Item

- `assign-activity` menu item in `src/modules/activities/config/menuConfig.ts` (lines 69, 103) still points to `/dashboard`
- Fix: create a dedicated `/assign-activity` page, or remove the menu item and rely on contextual assignment buttons on content pages

### E5 — No Admin UI for Wallet Adjustments and Reversals

- Transaction types `adjustment_credit`, `adjustment_debit`, `reversal`, `expiry` exist in the type system
- No admin UI to create these transaction types
- SuperAdmin cannot currently correct wallet errors manually

### E13 — Orders Export / Reporting

- Orders page refactor complete (two-card layout + filter search) but export/reporting still pending
- Add CSV/report snapshots for finance and support reconciliation workflows

### E4 — ImageBasedSingleChoice Quiz Runner

- Type defined in `src/types/assessment.ts`, explicitly commented out in `src/modules/assessments/quiz-runners/index.ts`. No component exists.
- No current assessments use this type — implement when needed

---

## SECTION 4: POST-LAUNCH ROADMAP

### Immediate (Week 1 After Launch)

- [ ] Deploy E2E automated test suite to CI/CD
- [ ] Set up production error tracking (Sentry or Vercel logs)
- [ ] Establish manual testing sign-off protocol
- [ ] Create user feedback collection mechanism

### Month 1–2

- [ ] Email notification flows (all 20+ identified) — **this is High, must be done before or immediately at launch**
- [ ] Super Admin reports (priority 1–5):
  1. Tenant Health Scorecard (per-tenant active users, coins, assignments, last activity)
  2. Coin Economy Summary (issued / utilized / treasury balance per tenant)
  3. Referral Funnel (sent → reminded → joined conversion per tenant)
  4. Assignment Activity (created / completed / cancelled over time)
  5. User Growth (new registrations by role and tenant over time)
- [ ] Wallet adjustment/reversal admin UI
- [ ] Assign-activity menu item fix
- [ ] Coin Requests tile in ACTIONS section
- [ ] ImageBasedSingleChoice quiz runner

### Month 2–3

- [ ] Super Admin reports (items 6–15):
  6. Cashout Pipeline (pending / approved / denied with ageing)
  7. Coin Purchase Report (Razorpay orders: volume, value, success rate)
  8. Assessment Completion (attempt rate, completion rate, avg score per assessment)
  9. Wallet Reconciliation (treasury balance vs sum of all user wallets — drift detection)
  10. Bot Engagement (guest sessions, messages, bot-generated referrals per tenant)
  11. Inactive Tenant Report (no activity in 30/60/90 days)
  12. Content Library (published vs draft per tenant)
  13. Cohort Utilisation (cohorts created, avg member count, assignment rate)
  14. Active Users Last 30 Days (login activity trends per tenant)
  15. Promotion Request Report (submitted / approved / denied, avg time to decision)
- [ ] Implement lead monetisation fee module — Super Admin monetisation settings for lead unlock fee configuration
- [ ] Creator earnings wallet UI — balance and history view for coach/company showing earned, available, and pending-settlement credits
- [ ] Advanced monetisation reporting — listing revenue, promotion revenue, commission revenue, lead unlock revenue, liabilities
- [ ] In-app notification centre — unread badge, in-app alerts, historical notification list
- [ ] Assessment versioning strategy — snapshot questions at attempt time or add version field

### Low Priority / Polish

- [ ] Bot referral route (`/api/bot/referral`) has no auth — add shared HMAC secret header. Low urgency: referral coins are non-redeemable, coins route to treasury, no financial extraction path exists.
- [ ] Add `source` field to `ReferralRecord` type — currently sent in API payload but not in type definition, so not persisted or queryable. Needed for bot-vs-manual referral reporting.
- [ ] SEO metadata — no `generateMetadata()` export in landing pages; add Next.js metadata exports (title, description, Open Graph) per studio landing page
- [ ] Analytics instrumentation — no analytics events tracked; choose a provider and add 8+ event types
- [ ] Benefits section — role-specific benefits/why-choose-us section not implemented (Coach vs Learner cards)
- [ ] Notification delivery audit tracking and per-tenant settings respected across all flows

### Performance & Scale

- [ ] Load testing with 1000+ concurrent users
- [ ] Database indexing optimisation
- [ ] CDN and caching strategy
- [ ] Error tracking and alerting system

---

## Summary Statistics

| Category | Count |
|---|---|
| **Critical Security Blockers** | **0** |
| **High Priority (launch-critical)** | **1** |
| Medium Priority Items | 5 |
| Post-Launch Roadmap Items | 20+ |
| **E2E Test Cases** | **140+** |
| **Automatable Tests** | **~110** |
| **Manual Tests** | **~30** |
