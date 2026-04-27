# StudioVerse — Outstanding Work & Test Strategy
**Last updated:** April 27, 2026  
**Status:** Pre-Launch E2E Testing Phase  
**Source:** Full codebase audit against E0–E12 epics. See `docs/CODEBASE_CONTEXT.md` for full context.

---

## SECTION 1: PENDING DEVELOPMENT TASKS

### Critical (Blockers)

No open critical blockers.

---

## High Priority

No open high priority items.

---

## Medium Priority

### E4 — SelectAndMove and ImageBasedSingleChoice Quiz Runners Unconfirmed
- Types for both render styles are defined in `src/types/assessment.ts`
- Components not confirmed present in `src/modules/assessments/quiz-runners/`
- Verify or implement: `SelectAndMoveQuiz.tsx`, `ImageBasedSingleChoiceQuiz.tsx`

### E4 — No AI Question Generation UI
- `aiGenerationPrompt` field is stored in assessment metadata
- No UI or service to trigger AI generation of questions from this prompt
- Would allow SuperAdmin to auto-populate question banks


### E5 — No Admin UI for Wallet Adjustments and Reversals
- Transaction types `adjustment_credit`, `adjustment_debit`, `reversal`, `expiry` exist in the type system
- No admin UI to create these transaction types
- SuperAdmin cannot currently correct wallet errors

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

---

## Resolved This Session (April 27, 2026)

- ✅ E1 — LoginRegisterModal now uses `saveUserProfile()` (registration path fixed)
- ✅ E8 — Route-level auth guards implemented via proxy middleware + cookies
- ✅ E8 — Duplicate menu configs consolidated (`coaching-studio/menuConfig.ts` → re-export barrel)
- ✅ E8 — Broken menu links fixed (`manage-cohort` → `/manage-cohorts`, `manage-users` → `/manage-users`)
- ✅ E8 — Sign Out already in place in both headers (no change required)
- ✅ E8 — Super Admin confirmed as standalone portal at `/admin` (by design)
- ✅ E2 — Promoted programs already surfaced with promoted-first ordering (no change required)
- ✅ E2/E3 — Thumbnail required-for-publish already enforced via `validateProgramForm` / `validateEventForm`
- ✅ E9 — Cohort member removal confirmed wired in UI and service
- ✅ E9 — Professional back-association on cohort save strengthened with canonical ID resolution
- ✅ E9 — Minimum 2-member cohort validation centralised via `MIN_COHORT_MEMBER_COUNT` constant
- ✅ E7 — Register Now / Try Now confirmed wired on Programs, Events, and Tools detail pages
- ✅ Cohort search fix — professional scoped individual search broadened to handle ID variants + phone normalisation
- ✅ Dead code removed — `src/config/studios/` folder and all three legacy studio config files deleted
- ✅ E5 — Buy Credits flow implemented with package management, order tracking, and Razorpay checkout verification
- ✅ E12 — Bot API rate limiting added for `/api/bot/chat` and `/api/bot/retrieve` (per-IP + session-aware)
- ✅ E12 — Bot knowledge retrieval now uses tenant-aware in-memory cache (no repeated file reads)
- ✅ E12 — Guest bot referrals now include `source: "BOT"` marker for reporting

---

## SECTION 2: END-TO-END TEST EXECUTION PLAN

### Test Execution Phases (140+ Test Cases)

**See `testplan.pdf` in `/docs/` for full test automation strategy and breakdown of automatable vs. manual tests.**

#### Quick Reference: What Can Be Automated vs Manual

**AUTOMATABLE (E2E Framework / API Tests):**
- ✅ Phase 1-3: Landing page load, registration, login for all 4 roles
- ✅ Phase 4-7: Profile completion, user creation, wallet initialization and transactions
- ✅ Phase 8-9: Activity assignment workflows, My Activities visibility
- ✅ Phase 10: Assessment completion, report generation
- ✅ Phase 11: Cohort creation, bulk assignment calculations
- ✅ Phase 12: Referral creation, join flow, wallet rewards
- ✅ Phase 14-15: RBAC menu visibility, cross-tenant isolation, route access blocking
- ✅ Unit tests: All service layer functions (users, assignments, wallets, cohorts, assessments)

**NOT EASILY AUTOMATED (Manual/Visual Tests):**
- ❌ Phase 1: Visual responsive design (mobile/tablet/desktop)
- ❌ Phase 1: Email delivery verification (placeholder implementation)
- ❌ Real payment/coin purchase flows
- ❌ Real SMS/OTP to actual phone numbers
- ❌ Video/media stream playback
- ❌ Bot intelligence quality evaluation
- ❌ User experience quality and intuitiveness
- ❌ Color contrast, accessibility compliance (partial automation with axe-core)
- ❌ Performance metrics under load

### Manual Testing Checklist

- [ ] **Browser Testing:** Chrome, Safari, Firefox (desktop + mobile viewports)
- [ ] **Mobile Responsiveness:** Test all flows on <600px viewport
- [ ] **Error Messages:** Verify clear messaging for edge cases
- [ ] **Session Persistence:** Refresh mid-journey, state retained
- [ ] **Performance:** Page load times, no freezes during assignment
- [ ] **Accessibility:** Keyboard navigation, color contrast, screen reader compat

### Automation Framework Recommendation

**Tools:** Playwright + TypeScript (with GitHub Actions CI/CD)

**Test Structure:**
```
tests/
├── e2e/
│   ├── auth.spec.ts           (P2-3: Registration, Login)
│   ├── profile.spec.ts         (P4: Profile completion)
│   ├── users.spec.ts           (P5: User management)
│   ├── content.spec.ts         (P6: Program/Event/Assessment creation)
│   ├── wallet.spec.ts          (P7-8: Wallet, Assignments)
│   ├── cohorts.spec.ts         (P11: Cohort workflows)
│   ├── referrals.spec.ts       (P12: Referral flows)
│   └── rbac.spec.ts            (P14-15: Access control)
├── api/
│   ├── users.test.ts           (API route tests)
│   ├── assignments.test.ts
│   └── wallets.test.ts
└── unit/
    ├── services.test.ts        (Service layer logic)
    └── utilities.test.ts
```

### Critical Path Tests (Run First)

1. **T1-Landing:** Page load, no errors → Pass
2. **T2-Register:** All 4 roles register successfully, wallets created → Pass
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
- [ ] Establish manual testing sign-off protocol
- [ ] Set up production monitoring and error tracking
- [ ] Create user feedback collection mechanism

### Short-term (Month 1-2)

- [ ] Implement missing features from Critical and High Priority sections above
- [ ] Fix all RBAC bypass vulnerabilities (E8)
- [ ] Add route-level authorization guards
- [ ] Consolidate menu configuration

### Medium-term (Month 2-3)

- [ ] Payment gateway production hardening (E5: Buy Credits flow)
- [ ] Real email notification delivery (referral invites, assignment notifications)
- [ ] Phone verification with OTP for non-test numbers
- [ ] Dashboard real widgets (upcoming activities, wallet summary, referral stats)
- [ ] Advanced analytics dashboard

### Performance & Scale

- [ ] Load testing with 1000+ concurrent users
- [ ] Database indexing optimization
- [ ] CDN and caching strategy
- [ ] API rate limiting (especially bot endpoints)
- [ ] Error tracking and alerting system (Sentry, etc.)

---

## Summary Statistics

| Category | Count |
|----------|-------|
| **Critical Blockers** | **0** |
| High Priority Items | 0 |
| Medium Priority Items | 3 |
| Low Priority / Polish | 6 |
| **E2E Test Cases** | **140+** |
| **Automatable Tests** | **~110** |
| **Manual Tests** | **~30** |
