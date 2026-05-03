# StudioVerse — Outstanding Work & Test Strategy

**Last updated:** May 3, 2026
**Status:** Pre-Launch Hardening + E2E Testing Phase
**Source:** Full codebase audit + security audit + OWASP audit (May 2026 session).

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

---

## SECTION 1: PENDING DEVELOPMENT TASKS

### Critical — Security (fix before go-live)

No open critical security blockers.

### High

- ⏳ **Email notifications — 20+ flows unimplemented** — notification service exists but no flows are wired. Priority order:
  - User self-registration welcome email
  - Activity assigned to user
  - Assignment status change (completed)
  - Cohort member added
  - Approval granted / denied (cashout, coin request, promotion, bot hero)
  - Referral invite (partially wired) and referral joined confirmation to referrer
- ⏳ **Super Admin reports** — 15 reports identified, none implemented. Priority:
  1. Tenant Health Scorecard (per-tenant active users, coins, assignments, last activity)
  2. Coin Economy Summary (issued / utilized / treasury balance per tenant)
  3. Referral Funnel (sent → reminded → joined conversion per tenant)
  4. Assignment Activity (created / completed / cancelled over time)
  5. User Growth (new registrations by role and tenant over time)
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
- ⏳ **ImageBasedSingleChoice quiz runner** — type defined in `src/types/assessment.ts`, explicitly commented out in `src/modules/assessments/quiz-runners/index.ts`. No component exists.
- ⏳ **Implement lead monetisation fee module** — Super Admin monetisation settings for lead unlock fee configuration. No service or UI exists.
- ⏳ **Creator earnings wallet UI** — balance and history view for coach/company showing earned, available, and pending-settlement credits.
- ⏳ **Advanced monetisation reporting** — listing revenue, promotion revenue, commission revenue, lead unlock revenue, liabilities. Separate from operational dashboard tiles.

### Security hardening (follow-through)

- ⏳ Convert OWASP findings into a per-release engineering checklist
- ⏳ Add automated security tests for high-risk paths (guest/public APIs, treasury-affecting callables, role-gated admin operations)
- ⏳ Add security regression verification in CI for authz boundary and protected collection write paths

---

## Medium Priority

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

---

## Low Priority / Polish

### Security

- ⏳ Bot referral route (`/api/bot/referral`) has no auth — add shared HMAC secret header. Low urgency: referral coins are non-redeemable, coins route to treasury, no financial extraction path exists.
- ⏳ Add `source` field to `ReferralRecord` type — currently sent in API payload but not in type definition, so not persisted or queryable. Needed for bot-vs-manual referral reporting.

### E0 — SEO Metadata

- No `generateMetadata()` export in landing pages
- Add Next.js metadata exports (title, description, Open Graph) per studio landing page

### E0 — Analytics Instrumentation

- No analytics events tracked (scroll depth, CTA clicks, role selection, auth funnel)
- Choose a provider and add 8+ event types

### E0 — Benefits Section

- Hero, programs, events, tools sections live
- Role-specific benefits/why-choose-us section not implemented (Coach vs Learner cards)

### E4 — Assessment Versioning

- No version control when assessment questions are updated
- Consider snapshotting questions at attempt time or adding a version field

### E11/E12 — Notification Polish

- Notification service scaffolded and templates JSON created
- Remaining: delivery audit tracking, notification settings per tenant respected across all flows

### In-App Notification Centre

- No notification centre, unread badge, or in-app alerts for any role
- Users have no way to see historical notifications or pending actions without navigating to each section

---

## SECTION 2: END-TO-END TEST EXECUTION PLAN

### Test Execution Phases (140+ Test Cases)

**See `testplan.pdf` in `/docs/` for full test automation strategy and breakdown of automatable vs. manual tests.**

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

### Critical Path Tests (Run First)

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

---

## SECTION 3: POST-LAUNCH ROADMAP

### Immediate (Week 1 After Launch)

- [ ] Deploy E2E automated test suite to CI/CD
- [ ] Set up production error tracking (Sentry or Vercel logs)
- [ ] Establish manual testing sign-off protocol
- [ ] Create user feedback collection mechanism

### Short-term (Month 1–2)

- [ ] Email notification flows (all 20+ identified)
- [ ] Super Admin reports (priority 1–5 from list above)
- [ ] Tenant activation checklist
- [ ] ImageBasedSingleChoice quiz runner
- [ ] Wallet adjustment/reversal admin UI
- [ ] Assign-activity menu item fix

### Medium-term (Month 2–3)

- [ ] Full Super Admin reports suite (items 6–15)
- [ ] In-app notification centre
- [ ] Creator earnings wallet UI
- [ ] Advanced monetisation reporting
- [ ] Lead monetisation fee module
- [ ] Assessment versioning strategy

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
| High Priority Items | 6 |
| Medium Priority Items | 4 |
| Low Priority / Polish | 7 |
| **E2E Test Cases** | **140+** |
| **Automatable Tests** | **~110** |
| **Manual Tests** | **~30** |
