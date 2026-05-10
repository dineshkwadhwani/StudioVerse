)# StudioVerse — Coaching Studio MVP · Test Cases

**Studio:** Coaching · **Generated:** May 2026 · **Roles:** SA = SuperAdmin · C = Company · P = Professional (Coach) · I = Individual

## Legend
- **[A]** — Automatable (unit, integration, e2e Playwright/Cypress).
- **[M]** — Manual verification only (UX, visual, ad-hoc payment, content quality).
- **[A/M]** — Hybrid: functional path automatable; visual / content / external integration verified manually.
- IDs follow the pattern `<area>-<seq>` for traceability.

---

## 1. Authentication & Registration

- **AUTH-001** [A] Phone OTP login succeeds with valid Firebase test phone + correct OTP.
- **AUTH-002** [A] Phone OTP login fails with invalid OTP and surfaces "Invalid code" message.
- **AUTH-003** [A] reCAPTCHA verifier loads on auth page (visible v2 in AuthWizard).
- **AUTH-004** [A] Self-registration as Company creates user doc with `userType=company` and tenantId.
- **AUTH-005** [A] Self-registration as Professional creates user doc + wallet with registration bonus credits.
- **AUTH-006** [A] Self-registration as Individual creates user doc + wallet with registration bonus credits.
- **AUTH-007** [A] SuperAdmin self-registration is blocked from the auth page.
- **AUTH-008** [A] Existing-phone login does not duplicate-create the user document.
- **AUTH-009** [A] Login redirects role correctly: SA → SA portal, others → studio dashboard.
- **AUTH-010** [A] Session storage keys (`cs_uid`, `cs_profile_id`, `cs_role`) populate after successful login.
- **AUTH-011** [M] Sign-out clears session storage and redirects to public landing.
- **AUTH-012** [A] Auto-referral processing fires on first sign-in if user was previously referred.
- **AUTH-013** [M] Visual: AuthWizard 5-phase progress UI renders correctly on mobile + desktop.
- **AUTH-014** [A] LoginRegisterModal alternative flow writes user doc (note: known gap — does not call `saveUserProfile()`).
- **AUTH-015** [A] Direct-URL access to authenticated page when signed out redirects to auth (where guards exist).

## 2. Tenant Management (SA)

- **TEN-001** [A] SA creates new tenant with unique slug — succeeds.
- **TEN-002** [A] Creating tenant with duplicate slug fails with clear error.
- **TEN-003** [A] Creating tenant with empty/invalid slug fails validation.
- **TEN-004** [A] SA edits tenant name & description; changes persist.
- **TEN-005** [A] SA sets `walletConfig` (opening, registration bonus, referral bonus, cashout min); values applied to new wallets in that tenant.
- **TEN-006** [A] SA sets `mailConfig` (sender + enabled); enabled=false suppresses outbound mail.
- **TEN-007** [A] SA sets `botConfig` (visible, persona, message cap); BotWidget reflects values.
- **TEN-008** [A] SA sets `landingConfig` toggles (programs/events/tools sections); landing page hides disabled sections.
- **TEN-009** [A] SA sets `leadConfig` per-type fees; `resolveLeadUnlockFee()` returns correct value.
- **TEN-010** [A] Disabling lead type via toggle returns 0 fee from resolver.
- **TEN-011** [A] Treasury wallet auto-created at tenant creation with `treasury::<tenantId>` id and `superAdminOpeningCoins` balance.
- **TEN-012** [A] Non-SA users cannot read or write tenant docs (rules enforce).

## 3. User Management

- **USR-001** [A] SA creates user of any role with valid data — succeeds.
- **USR-002** [A] Company creates Professional via Manage Users — `associatedCompanyId` stamped to company uid; wallet created with 0 opening (no registration bonus for company-onboarded coaches).
- **USR-003** [A] Company creates Individual — `associatedCompanyId` set; wallet has registration bonus.
- **USR-004** [A] Professional creates Individual — `associatedProfessionalId` set to coach uid.
- **USR-005** [A] Cross-tenant user listing is blocked for non-SA roles via rules.
- **USR-006** [A] User edits own profile — `userType`, `role`, `tenantId`, association fields immutable from client (rules block).
- **USR-007** [A] Auto-provisioning: assigning to an unknown phone creates an Individual + wallet on-the-fly.
- **USR-008** [A] Phone-deduplication: scoped-create rejects a phone already on the platform within tenant.
- **USR-009** [A] Profile picture upload succeeds; URL persisted on user doc.
- **USR-010** [A] Profile completion % updates as required fields are filled.
- **USR-011** [A] `assignmentEligible` becomes true only when mandatory profile fields are complete.
- **USR-012** [M] Visual: long names, special characters, RTL email render correctly in Manage Users list.
- **USR-013** [A] Role-escalation attempt (client write changing `userType` to superadmin) is rejected by rules.
- **USR-014** [A] SA delete user soft-deletes/de-activates and removes from listing.
- **USR-015** [A] Listing pagination/search across users works (if implemented).

## 4. Programs

- **PRG-001** [A] SA creates Program with all required fields — saves & returns id.
- **PRG-002** [A] Publishing a Program with `availableFrom` in future hides it from public listings until that date.
- **PRG-003** [A] Publishing without thumbnail (when required) is blocked or warned.
- **PRG-004** [A] Multi-tenant publish: `tenantIds[]` correctly publishes program in additional tenants.
- **PRG-005** [A] Primary `tenantId` is immutable after creation.
- **PRG-006** [A] `creditsRequired` value is debited on assignment.
- **PRG-007** [A] Audit log entry written on program create & update.
- **PRG-008** [A] Unpublishing removes program from public lists.
- **PRG-009** [A] `expiresAt` past expiry hides program from public lists.
- **PRG-010** [A] Catalog visibility scope (platform/company/professional) gates listing in scope correctly.
- **PRG-011** [A] Functions Zod validation rejects malformed program payloads.
- **PRG-012** [M] Visual: program detail page renders all fields with proper formatting.

## 5. Events

- **EVT-001** [A] SA creates Event with all required fields — saves & returns id.
- **EVT-002** [A] Promoted-first ordering surfaces promoted events ahead of others on landing.
- **EVT-003** [A] City field indexed and searchable in universal search.
- **EVT-004** [A] Date-window visibility honors `availableFrom`/`expiresAt`.
- **EVT-005** [A] Multi-tenant publish via `tenantIds[]` works.
- **EVT-006** [A] Cancelled status hides event from public lists.
- **EVT-007** [A] Audit log written on create/update.
- **EVT-008** [M] Visual: event detail page renders date/time, city, image correctly.

## 6. Assessments (Tools)

- **ASMT-001** [A] SA creates Assessment with render style + report style — saves.
- **ASMT-002** [A] Adding assessment questions persists and orders by `sortOrder`.
- **ASMT-003** [A] SingleChoice runner records selected answer per question.
- **ASMT-004** [A] LikertRatingScale runner persists 1-5/1-7 ratings.
- **ASMT-005** [A] SliderScale runner persists numeric scale values.
- **ASMT-006** [A] InstantFeedbackMultiChoice runner shows correct/incorrect feedback per question.
- **ASMT-007** [A] GamifiedDragDrop runner records ordered drop sequence.
- **ASMT-008** [A] ForcedTradeoff runner records selected option per pair.
- **ASMT-009** [A] Assessment attempt persisted with `userId = auth.uid` (post May 9 fix).
- **ASMT-010** [A] AssessmentReport persisted; `userId = auth.uid` for new reports.
- **ASMT-011** [A] Report read accessible to (a) report `userId`, (b) assignment.assigneeId, (c) assignment.assignerId, (d) SA.
- **ASMT-012** [M] AI report content is coherent, on-template, and references attempt answers (Groq llama-3.3-70b).
- **ASMT-013** [A] Re-completing same assignment supersedes the prior report (or appends per design).
- **ASMT-014** [M] Visual: report sections render per template (10 templates × at least one assessment each).
- **ASMT-015** [A] Functions validation rejects assessment without questions on publish.
- **ASMT-016** [A] AI report generation is asynchronous; UI shows "preparing" then resolves.

## 7. Assignments

- **ASGN-001** [A] Coach assigns Program to known Individual — assignment created, wallet debit recorded.
- **ASGN-002** [A] Coach assigns to unknown phone — Individual auto-provisioned with wallet.
- **ASGN-003** [A] Cohort assignment debits members × creditsRequired atomically (all-or-none).
- **ASGN-004** [A] Insufficient wallet blocks assignment with clear message.
- **ASGN-005** [A] Self-assignment exempt from creator-earnings (treasury path).
- **ASGN-006** [A] Recommendation flow creates `status=recommended` assignment without debit.
- **ASGN-007** [A] Status transitions: assigned → in_progress → completed allowed by rules.
- **ASGN-008** [A] Cancelling assignment refunds the debit per `returnDebitsToTreasury` trigger semantics.
- **ASGN-009** [A] My Activities lists only assignments where current user is assignee.
- **ASGN-010** [A] Assigned Activities lists only assignments where current user is assignor.
- **ASGN-011** [M] Email notification fires on assignment creation (Resend).
- **ASGN-012** [A] Assignment created against not-eligible profile is blocked (`assignmentEligible=false`).
- **ASGN-013** [A] Assignment to a different tenant member fails (tenant isolation).

## 8. Cohorts

- **COH-001** [A] Coach creates cohort with ≥2 members → status `active`.
- **COH-002** [A] Cohort with 1 member → status `inactive`; assignment blocked.
- **COH-003** [A] Removing members below 2 flips status to inactive at runtime.
- **COH-004** [A] Adding professional and ≥2 individuals satisfies activation rule.
- **COH-005** [A] Listing scoped to creator returns only own cohorts (not platform-wide for non-SA).
- **COH-006** [A] Member search excludes already-associated individuals (per association rules).
- **COH-007** [M] Cohort assignment writes per-member assignment docs all under one transaction.

## 9. Wallet & Coins

- **WAL-001** [A] Wallet auto-created on user registration with tenant's opening rules.
- **WAL-002** [A] Treasury wallet read denied to non-SA from client.
- **WAL-003** [A] Wallet update on own wallet allows spend (availableCoins decrease) but blocks mint (availableCoins increase) for non-SA, non-company arms.
- **WAL-004** [A] Company-credit arm allows company to credit associated coach's wallet (verified May 9).
- **WAL-005** [A] Coin transfer creates two ledger entries: `sent` (sender) + `received` (recipient).
- **WAL-006** [A] `walletTransactions` read returns docs to any signed-in user (post May 10 rule fix); treasury txns are not gated by client (acknowledged risk).
- **WAL-007** [A] Coin request creation by Professional (independent or company-associated) succeeds.
- **WAL-008** [A] Company approves coin request → wallets adjust, request `approved`, ledger pair written.
- **WAL-009** [A] Company denies coin request → coach refunded any held credits, request `denied`.
- **WAL-010** [A] Cashout request: amount debited (held) on submission; status `pending`.
- **WAL-011** [A] Cashout below tenant minimum is blocked.
- **WAL-012** [A] SA approves cashout → status `approved`; debit remains.
- **WAL-013** [A] SA denies cashout → held amount refunded.
- **WAL-014** [A] Coin package CRUD by SA — create, edit, deactivate.
- **WAL-015** [A] Buy-coins order flow: created → pending → paid (simulate success) credits wallet exactly once (idempotent).
- **WAL-016** [A] Buy-coins simulate failure → order remains `pending`, no wallet change.
- **WAL-017** [A] Registration bonus credited only once per user (idempotency on rehydration).
- **WAL-018** [A] Referral join bonus credited via `processReferralJoinForNewUser` exactly once.
- **WAL-019** [A] Treasury auto top-up writes a backfill ledger entry when triggered.
- **WAL-020** [A] Creator-earnings trigger routes debit to creator wallet for non-platform content; to treasury for platform content; to company if coach has `associatedCompanyId`.

## 10. Referrals

- **REF-001** [A] User creates referral by phone/email → `referrals` doc created with `tenantId`.
- **REF-002** [A] Status flow: referred → reminded → joined.
- **REF-003** [A] Reminder sent updates lastRemindedAt; reminder count increments.
- **REF-004** [A] Joined status fires referral bonus on referrer + registration bonus on joiner.
- **REF-005** [A] No duplicate join bonus on second login of joiner.
- **REF-006** [A] SA referral page filters by tenant + status correctly.
- **REF-007** [M] Email content for invite/reminder renders properly with placeholder values.

## 11. Bot Hero

- **BHX-001** [A] SA creates Bot Hero package — saves with image, durations, credits.
- **BHX-002** [A] Coach without profile photo cannot submit Bot Hero request.
- **BHX-003** [A] Coach with insufficient credits cannot submit.
- **BHX-004** [A] Submission debits credits on creation; refund recorded on denial.
- **BHX-005** [A] SA approval with overlapping date range against an active hero is blocked.
- **BHX-006** [A] Approved hero status flips to `active` at start date and `expired` at end date.
- **BHX-007** [A] BotWidget overrides persona to coach name/avatar within active window.
- **BHX-008** [A] BotWidget reverts to tenant default after expiry.
- **BHX-009** [M] Visual: hero image renders correctly in widget at multiple breakpoints.
- **BHX-010** [A] Multiple future-dated requests allowed if dates do not overlap.

## 12. Bot Chat

- **BOT-001** [A] BotWidget mounts on landing and authenticated layouts when `botConfig.visible=true`.
- **BOT-002** [A] Studio Bot mode answers within 6-turn conversational history window.
- **BOT-003** [A] Professional Bot mode uses coach-specific system prompt.
- **BOT-004** [A] Guest message cap honored; cap exceeded shows email-capture state.
- **BOT-005** [A] Email captured post-cap creates a referral with referrer = oldest SA.
- **BOT-006** [M] Knowledge retrieval surfaces relevant snippets (TF-IDF) for sample queries.
- **BOT-007** [M] AI answers grounded in knowledge base; off-topic queries decline politely.
- **BOT-008** [A] Knowledge base file present at `public/bot-knowledge/coaching-studio.json`.
- **BOT-009** [M] No rate limiting today (acknowledged risk) — flag in test-readiness summary.

## 13. Promotions & Listings

- **PROMO-001** [A] SA creates Promotion Package — saves with credits + duration.
- **PROMO-002** [A] Coach requests promotion of own program/event — debit recorded.
- **PROMO-003** [A] SA approves promotion — `promotionStatus` becomes `active`; surfaces in listings.
- **PROMO-004** [A] SA denies — credits refunded; status `denied`.
- **PROMO-005** [A] Active promotion expires at end date; status flips `expired`.
- **PROMO-006** [A] Listing Package CRUD by SA.
- **PROMO-007** [M] Listing fee charge on public publish — gap acknowledged; flag if introduced.

## 14. Approvals & Admin Requests

- **APR-001** [A] SA dashboard tiles show correct pending counts for promotion / cashout / bot hero / listing.
- **APR-002** [A] Approve Requests page deep-links to correct tab via dashboard tile.
- **APR-003** [A] Approve action on each tab updates request status & writes ledger if applicable.
- **APR-004** [A] Deny action on each tab updates request status & refunds where applicable.
- **APR-005** [A] Company sees only own coin-request approvals (scoped).
- **APR-006** [M] Visual: approvals UI handles long lists, search, sort, and empty states.

## 15. Reports & Analytics

- **RPT-001** [A] SA dashboard tiles compute correct totals (users, tenants, programs, events, assessments).
- **RPT-002** [A] Coin-issued / coin-remaining tile values match treasury ledger sums.
- **RPT-003** [A] Referral made / joined counts match referrals collection.
- **RPT-004** [A] Cashout/Purchase ratio tile recomputes after a new order or cashout.
- **RPT-005** [A] Orders page filters (status, date range, role) return correct rows.
- **RPT-006** [A] User dashboard activity-completion stats reflect own activity only.
- **RPT-007** [M] Visual: dashboard tiles render at multiple zoom levels and devices.

## 16. Landing Page & Public Content

- **LAND-001** [A] Landing renders for unauthenticated visitor at `/coaching-studio`.
- **LAND-002** [A] Programs / Events / Tools carousels populate from published content.
- **LAND-003** [A] Promoted Events appear before non-promoted.
- **LAND-004** [A] Header swaps to user menu when signed in.
- **LAND-005** [M] Visual: hero, counters, sections render at desktop / tablet / mobile.
- **LAND-006** [M] No SEO `generateMetadata()` today (gap) — flag.
- **LAND-007** [M] No analytics events fire on CTA click (gap) — flag.

## 17. Search & User Discovery (E16)

- **SRCH-001** [A] Search on Programs by keyword returns matching name/description.
- **SRCH-002** [A] Search on Events matches name/description/city.
- **SRCH-003** [A] Search on Coaches matches name/headline/bio/credentials/certifications.
- **SRCH-004** [A] Individual searcher does not see Individuals category (per rules).
- **SRCH-005** [A] Company/Professional searcher does not see Companies category.
- **SRCH-006** [A] Searcher sees only **unassociated** Individuals/Coaches per association protection rule.
- **SRCH-007** [A] Lead tile shows Locked when fee > 0 and not yet unlocked; Unlocked otherwise.
- **SRCH-008** [A] Unlock confirms credit debit and writes `leadUnlocks` entry; idempotent on retry.
- **SRCH-009** [A] Insufficient credits blocks unlock with clear message.
- **SRCH-010** [A] Disabled lead type via tenant config returns 0 fee (always unlocked).
- **SRCH-011** [M] Visual: lead tile shows engagement-index / activity-index correctly.
- **SRCH-012** [A] Search input < 2 chars does not query backend.

## 18. Messaging & Intro Messages (E16)

- **MSG-001** [A] Coach/Company sender sees both T1 and T2 templates in modal.
- **MSG-002** [A] Individual sender sees only T1 template.
- **MSG-003** [A] T2 template substitutes profile fields (headline, credentials) when present; falls back when absent.
- **MSG-004** [A] Coach→Individual message arrives unlocked.
- **MSG-005** [A] Individual→Coach/Company message arrives locked.
- **MSG-006** [A] Locked message preview hidden; lock icon and unlock fee visible.
- **MSG-007** [A] Unlock action debits fee and flips `isLocked=false`.
- **MSG-008** [A] Repeat-send to same recipient returns duplicate state and does not re-debit.
- **MSG-009** [A] Inbox/Outbox lists ordered by createdAt desc.
- **MSG-010** [A] Message rule prevents non-participant reads (sender/receiver/SA only).

## 19. Notifications

- **NOT-001** [A] SA toggles a notification category off — outbound mail is suppressed.
- **NOT-002** [A] Reminder days config respected for botHero/promotion/listing expiring soon.
- **NOT-003** [M] Email content (assignment created, coin request approved/denied, etc.) renders cleanly with placeholders filled.
- **NOT-004** [A] Notification log records sent/blocked/failed for each delivery attempt.
- **NOT-005** [A] Tenant `mailConfig.enabled=false` blocks all outbound; logs as `blocked`.

## 20. Lead Config & Lead Fees

- **LEAD-001** [A] Per-tenant lead fee values applied for Coach / Company / Individual leads.
- **LEAD-002** [A] Toggling a lead type off zeros the fee returned by `resolveLeadUnlockFee`.
- **LEAD-003** [A] Search results respect lead type visibility per tenant config.
- **LEAD-004** [A] Lead unlock fee equals message unlock fee for the same target type.

## 21. Revenue Routing & Treasury

- **REV-001** [A] `returnDebitsToTreasury` trigger routes platform-content debits to treasury.
- **REV-002** [A] Creator-content debits route to creator wallet (or company wallet if creator has `associatedCompanyId`).
- **REV-003** [A] Self-assignment routes debits to treasury (no creator self-payout).
- **REV-004** [A] Idempotency marker `creator-earning-{txId}` prevents double-credits on retry.
- **REV-005** [A] Treasury auto top-up triggers when balance below threshold and credits the configured amount.
- **REV-006** [M] Marketplace commission split (gap) — verify if/when introduced.

## 22. Buy Credits / Coin Packages

- **BUY-001** [A] Coin package list renders only `active=true` packages with sortOrder.
- **BUY-002** [A] Selecting a package + Confirm Order creates Order with status `created`.
- **BUY-003** [A] Reaching payment screen flips order to `pending`.
- **BUY-004** [A] Simulate Success → `paid`, wallet credited, transaction `credit/source=manual_offline_allocation` (or as per design).
- **BUY-005** [A] Simulate Failure → order remains `pending`, no wallet change.
- **BUY-006** [A] `walletCredited=true` guard prevents duplicate credit on retry.
- **BUY-007** [M] Real Razorpay integration test (when introduced).
- **BUY-008** [A] User sees only own orders (not implemented yet — gap).

## 23. Profile

- **PROF-001** [A] Edit own profile saves all editable fields.
- **PROF-002** [A] Privilege-escalation fields blocked (userType, role, status).
- **PROF-003** [A] Profile picture upload to Storage succeeds and URL persists.
- **PROF-004** [A] Profile completion % updates after each field set.
- **PROF-005** [A] Mandatory fields gate `assignmentEligible`.

## 24. Cross-cutting / Non-functional

- **NFR-001** [A] Build succeeds on `next build` for all studios.
- **NFR-002** [A] Type-check (`tsc --noEmit`) passes with strict mode.
- **NFR-003** [A] Lint passes with no errors.
- **NFR-004** [A] Firestore rules unit-tests (`@firebase/rules-unit-testing`) cover wallets, walletTransactions, assessmentReports, users.
- **NFR-005** [A] Firebase Functions handlers covered by unit tests for happy + failure paths.
- **NFR-006** [M] Manual security review on rule diff before each prod deploy.
- **NFR-007** [M] Cross-browser smoke (Chrome / Safari / Firefox) at each release.
- **NFR-008** [M] Mobile responsive smoke (iOS Safari / Android Chrome) at each release.
- **NFR-009** [M] Accessibility spot-check (keyboard nav, contrast) on auth + dashboard + manage pages.
- **NFR-010** [M] Email rendering smoke (Gmail, Outlook web) for one notification per category.
- **NFR-011** [A] Performance budget: landing TTI < 3s on Vercel preview.
- **NFR-012** [A] No client-side leakage of secrets (scan bundle).
- **NFR-013** [A] Tenant isolation: cross-tenant reads/writes blocked by rules (regression).

## 25. Regression — Recently-Fixed Issues (May 2026)

- **REG-001** [A] Company can credit coach's wallet via approve coin request without `permission-denied` (May 9 fix).
- **REG-002** [A] `walletTransactions` create accepts `sent`/`received` types from company user (May 9 fix).
- **REG-003** [A] Individual user can read own assessment report on first open (May 9 service+rule fix).
- **REG-004** [A] Coach/assignor can read assignee's assessment report when linked via assignment (May 9 fix).
- **REG-005** [A] Company user can list `walletTransactions` for an associated coach in coin-request flow (May 10 rule fix).

---

## Summary by Test Category

| Area | Total | Automatable [A] | Manual [M] | Hybrid [A/M] |
|---|---:|---:|---:|---:|
| Authentication & Registration | 15 | 13 | 2 | 0 |
| Tenant Management | 12 | 12 | 0 | 0 |
| User Management | 15 | 14 | 1 | 0 |
| Programs | 12 | 11 | 1 | 0 |
| Events | 8 | 7 | 1 | 0 |
| Assessments | 16 | 14 | 2 | 0 |
| Assignments | 13 | 12 | 1 | 0 |
| Cohorts | 7 | 6 | 1 | 0 |
| Wallet & Coins | 20 | 20 | 0 | 0 |
| Referrals | 7 | 6 | 1 | 0 |
| Bot Hero | 10 | 9 | 1 | 0 |
| Bot Chat | 9 | 6 | 3 | 0 |
| Promotions & Listings | 7 | 6 | 1 | 0 |
| Approvals | 6 | 5 | 1 | 0 |
| Reports & Analytics | 7 | 6 | 1 | 0 |
| Landing Page | 7 | 4 | 3 | 0 |
| Search & Discovery | 12 | 11 | 1 | 0 |
| Messaging | 10 | 10 | 0 | 0 |
| Notifications | 5 | 4 | 1 | 0 |
| Lead Config | 4 | 4 | 0 | 0 |
| Revenue Routing | 6 | 5 | 1 | 0 |
| Buy Credits | 8 | 7 | 1 | 0 |
| Profile | 5 | 5 | 0 | 0 |
| Non-functional | 13 | 8 | 5 | 0 |
| Regression (May fixes) | 5 | 5 | 0 | 0 |
| **Total** | **239** | **210** | **29** | **0** |

**Automation coverage target:** ~88% of cases automatable (210 of 239). Manual coverage focuses on visual rendering, AI content quality, payment integration, and accessibility — all areas where automated assertions are unreliable or non-meaningful in MVP.

---

## Test environments

- **Unit / rules**: Firebase emulator suite + Vitest/Jest.
- **Integration / functions**: Firebase emulator + supertest-style HTTP calls.
- **E2E**: Playwright against `studioverse-test` deploy with seeded fixtures.
- **Manual**: `studioverse-test` Vercel preview branch + a smoke test phone with fixed OTP.

---

*See `USER_JOURNEYS_COACHING_MVP.html` for human-readable role journeys and `QUALITY_PLAN.html` for the QA strategy/process backing these tests.*
