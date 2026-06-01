# StudioVerse — SuperAdmin And Landing Test Journeys

Status: Working manual regression guide derived from current code paths.  
Priority order: SuperAdmin first, then Landing Page, then registration/profile and creator journeys.

Role-based split and workbook-ready sheets:

- `docs/06-quality-testing/markdown/ROLE_TEST_PACK_INDEX.md`

## Sources Consulted

- `docs/01-architecture/ARCHITECTURE_OVERVIEW.md`
- `docs/00-agent-context/COPILOT_CONTEXT.md`
- `docs/05-deployment/ROLE_RESPONSIBILITY_MATRIX.md`
- `docs/04-technical-stories/markdown/TEST_CASES.md`

## Code Paths Traced

- `src/modules/admin/SuperAdminPortal.tsx`
- `src/modules/admin/ApproveRequestsPage.tsx`
- `src/modules/admin/SeedDataPage.tsx`
- `src/modules/admin/ProgramsSection.tsx`
- `src/modules/admin/AssessmentsSection.tsx`
- `src/modules/landing/pages/LandingPage.tsx`
- `src/services/profile.service.ts`
- `src/services/wallet.service.ts`
- `src/app/api/users/create-scoped/route.ts`

## Test Planning Notes

- SuperAdmin tenant status should not move to `active` until the activation checklist is complete.
- Landing-page admin toggles currently affect Programs, Tools, and Events sections only.
- SuperAdmin-created users are invitation-based. Company, Professional, and Individual wallets are not created at invite creation time; they are created when the invited user claims and completes registration.
- Company and Professional scoped user creation is different: it creates the user, wallet, and initial wallet transaction immediately.
- SuperAdmin users do not receive a wallet.
- Non-SuperAdmin publish and promote actions use listing or promotion packages and approval queues rather than going live immediately.

## 1. SuperAdmin Journeys

### SA-01 Create Tenant And Validate Settings

Actor: SuperAdmin

Goal: Confirm a tenant can be created and all tenant-level settings persist and drive downstream behavior.

Steps:

1. Open SuperAdmin Portal and create a tenant with a unique `tenantId`, name, domain, and root context.
2. Fill tenant settings for landing, wallet, mail, bot, lead, search, and referral controls.
3. Save the tenant as `inactive` first.
4. Re-open the tenant and verify values are loaded back into the form.

Validate:

- `landingConfig.sections`, `carouselItemLimits`, `displayLabels`, and `sectionIntros` persist.
- `walletConfig.superAdminOpeningCoins`, `registrationFreeCoins`, `referralFreeCoins`, and `cashout` settings persist.
- `mailConfig.enabled`, `fromEmail`, and `fromName` persist.
- `botConfig.visible`, bot mode toggles, `personaName`, and `messageCap` persist.
- `leadConfig`, `searchConfig`, and `referralConfig` persist.
- Tenant cannot be set to `active` until checklist requirements are satisfied.

### SA-02 Validate Activation Checklist Gate

Actor: SuperAdmin

Goal: Confirm checklist auto-detection and status gating work.

Steps:

1. Open the checklist manager for a tenant.
2. Leave one of the required readiness areas incomplete.
3. Try to mark the tenant `active`.
4. Complete mail, wallet, bot, and content prerequisites.
5. Save the checklist and mark the tenant `active`.

Validate:

- Incomplete checklist blocks `active` status.
- Checklist readiness reflects live system state for mail, wallet, bot, and published content.
- Once all checklist items are complete, the tenant can be activated.

### SA-03 Ensure Treasury Wallet Exists

Actor: SuperAdmin

Goal: Confirm tenant treasury creation and opening balance logic.

Steps:

1. After tenant creation, open Manage Wallet.
2. Filter for Treasury.
3. If needed, run the treasury ensure or backfill path.

Validate:

- Wallet id follows `treasury::<tenantId>`.
- Treasury wallet user name is `Tenant Treasury`.
- Opening balance equals `walletConfig.superAdminOpeningCoins`.
- A wallet transaction exists with reason `Tenant treasury opening balance`.

### SA-04 Create Another SuperAdmin

Actor: SuperAdmin

Goal: Confirm additional SuperAdmin creation works without wallet side effects.

Steps:

1. From Manage Users, create a new user with role `superadmin`.
2. Complete the invitation or registration claim flow for that user.
3. Sign in as the new SuperAdmin.

Validate:

- User is created under the platform context.
- New user can access SuperAdmin surfaces.
- No wallet is created for the new SuperAdmin.
- No treasury debit happens for this user creation path.

### SA-05 Create Company, Coach, And Individual From SuperAdmin

Actor: SuperAdmin

Goal: Confirm invitation-based creation and downstream wallet behavior.

Steps:

1. Create one Company, one Professional, and one Individual from SuperAdmin.
2. Verify invitation records are created.
3. Claim each invitation through the registration flow.
4. Inspect wallet state after claim.

Validate:

- At invite creation time, the user is invited but wallet creation is deferred.
- After claim, Company, Professional, and Individual users receive wallets through self-registration flow.
- Registration bonus is applied only to wallet-bearing user types.
- Treasury impact happens at claim-time, not invite-time.

### SA-06 Check Wallet Allocation And Treasury Debit Semantics

Actor: SuperAdmin

Goal: Confirm wallet side effects are correct for each creation path.

Steps:

1. Compare a SuperAdmin-created invited user against a Company-created or Professional-created managed user.
2. Inspect wallet and wallet transaction documents for each case.

Validate:

- SuperAdmin invite path: wallet appears only after claim.
- Scoped create path: wallet and initial issuance happen immediately.
- SuperAdmin user type never gets a wallet.
- Registration or initial issuance happens once only.

### SA-07 Seed Earning Packages

Actor: SuperAdmin

Goal: Confirm package seeding works and can be safely rerun.

Steps:

1. Open Seed Data for a tenant.
2. Seed credit packages.
3. Seed promotion packages.
4. Seed listing packages.
5. Seed bot hero packages.
6. Seed lead packages.
7. Re-run each seed.

Validate:

- First run reports records added.
- Second run reports already seeded or no-op behavior.
- Seeded packages appear in the relevant package management screens.
- Seeded packages become selectable in resource create flows.

### SA-08 Create Assessment And Verify Publish And Promote

Actor: SuperAdmin

Goal: Confirm Assessment publish and promote behavior.

Steps:

1. Create an Assessment with required metadata and questions.
2. Save as draft.
3. Enable Publish and save.
4. Enable Promote with a promotion package and save.

Validate:

- Draft stays unpublished.
- Publish sets published state directly for SuperAdmin.
- Promote marks the Assessment as promoted immediately for SuperAdmin.
- Landing page Tools section surfaces the Assessment when tenant scope and visibility allow it.

### SA-09 Create Program And Verify Publish And Promote

Actor: SuperAdmin

Goal: Confirm Program publish and promote behavior.

Steps:

1. Create a Program with valid metadata.
2. Save as draft.
3. Publish it.
4. Promote it using a promotion package.
5. Open the landing page.

Validate:

- Program moves from draft to published.
- Promotion status updates correctly.
- Landing page Programs section prefers promoted items when they exist.
- Run a negative test for a public but unpublished Program and verify it does not leak to landing.

### SA-10 Create Event And Verify Publish And Promote

Actor: SuperAdmin

Goal: Confirm Event publish and promote behavior.

Steps:

1. Create an Event with valid schedule and visibility.
2. Save as draft.
3. Publish it.
4. Promote it.
5. Open the landing page.

Validate:

- Event moves from draft to published.
- Promoted Events sort ahead of non-promoted Events.
- Only published, public tenant-matching Events appear on landing.

### SA-11 Approve Wallet, Bot, Cashout, Listing, And Promotion Requests

Actor: SuperAdmin

Goal: Confirm all admin approval queues are usable and cause the expected downstream effects.

Steps:

1. Open Approve Requests.
2. Review Promotion tab.
3. Review Cash Out tab.
4. Review Listing tab.
5. Review Bot Hero tab.
6. Approve one request in each queue where possible.
7. Deny one request in each queue where possible.

Validate:

- Tab badges show pending counts.
- Approve updates request status and dependent entities.
- Deny updates request status and triggers refunds where applicable.
- Cashout approval stamps approver, payout placeholder data, and approval timestamp.
- Bot Hero approval enforces one active hero window per tenant.

### SA-12 Company Coin Request Approval

Actor: SuperAdmin and Company

Goal: Confirm coin-request lifecycle and ledger behavior.

Steps:

1. As a Professional, submit a coin request to an associated Company.
2. As that Company, approve the request.
3. Repeat with a denial case.

Validate:

- Request status changes from `pending` to `approved` or `denied`.
- Approval transfers coins from Company wallet to Professional wallet.
- Ledger entries are written for the transfer.
- Denial leaves the request closed without crediting the Professional.

## 2. Landing Page Journeys

### LAND-01 Default Landing Rendering

Actor: Guest visitor

Goal: Confirm the tenant landing page loads with dynamic DB overrides.

Steps:

1. Open the tenant landing page while signed out.
2. Confirm hero, section labels, and section intros render.

Validate:

- Landing fetches tenant `landingConfig` from Firestore.
- DB-configured labels and intros override static defaults.
- Signed-out CTA is `Sign In / Register`.

### LAND-02 Toggle Programs Section

Actor: SuperAdmin and Guest

Goal: Confirm the Programs section can be disabled and re-enabled.

Steps:

1. In tenant settings, switch Programs section off.
2. Reload the landing page.
3. Switch Programs section on again.
4. Reload the landing page.

Validate:

- Programs carousel disappears when disabled.
- Programs carousel reappears when enabled.
- Programs display label and intro use configured values.

### LAND-03 Toggle Tools Section

Actor: SuperAdmin and Guest

Goal: Confirm the Tools section can be disabled and re-enabled.

Steps:

1. Switch Tools section off.
2. Reload landing.
3. Switch it on.
4. Reload landing.

Validate:

- Tools carousel disappears and reappears correctly.
- Assessments shown are tenant-scoped and public.

### LAND-04 Toggle Events Section

Actor: SuperAdmin and Guest

Goal: Confirm the Events section can be disabled and re-enabled.

Steps:

1. Switch Events section off.
2. Reload landing.
3. Switch it on.
4. Reload landing.

Validate:

- Events carousel disappears and reappears correctly.
- Promoted Events still rank first when the section is enabled.

### LAND-05 Validate Carousel Limits And Labels

Actor: SuperAdmin and Guest

Goal: Confirm section limits and labels affect presentation.

Steps:

1. Reduce Programs, Tools, and Events carousel limits.
2. Change display labels and intros.
3. Reload landing.

Validate:

- Each section respects the configured item limit.
- Custom display labels appear.
- Custom intro copy appears.

### LAND-06 Signed-In Header State

Actor: Company, Professional, Individual

Goal: Confirm landing header changes after authentication.

Steps:

1. Sign in as each role.
2. Open the landing page.

Validate:

- User menu replaces the guest CTA.
- Role-specific navigation and search/referral items follow tenant config.

## 3. Registration Journeys

### AUTH-01 Register As Company

Actor: New Company user

Goal: Confirm self-registration rules for Company.

Steps:

1. Start registration from the landing page.
2. Choose Company.
3. Enter valid company details including email.
4. Complete OTP and registration.

Validate:

- Company registration requires a valid email.
- User is created with `userType=company`.
- Wallet is created and registration bonus is applied.
- User lands in the authenticated app shell.

### AUTH-02 Register As Coach

Actor: New Professional user

Goal: Confirm Professional self-registration.

Steps:

1. Start registration from the landing page.
2. Choose Professional.
3. Complete OTP and registration.

Validate:

- User is created with `userType=professional`.
- Wallet is created.
- Registration bonus is applied once.

### AUTH-03 Register As Individual

Actor: New Individual user

Goal: Confirm Individual self-registration.

Steps:

1. Start registration from the landing page.
2. Choose Individual.
3. Complete OTP and registration.

Validate:

- User is created with `userType=individual`.
- Wallet is created.
- Registration bonus is applied once.

## 4. Profile Journeys

### PRO-01 Update Profile Details

Actor: Company, Professional, Individual

Goal: Confirm profile persistence.

Steps:

1. Open Profile.
2. Update required fields.
3. Save.

Validate:

- Updated fields persist.
- Immutable role and tenant fields are not changed by normal profile edits.

### PRO-02 Validate Completion Percentage And Eligibility

Actor: Company, Professional, Individual

Goal: Confirm completion and assignment readiness are recalculated.

Steps:

1. Save an incomplete profile.
2. Observe completion percentage and assignment status.
3. Fill all mandatory fields and save again.

Validate:

- `profileCompletionPercent` increases as required data is added.
- `assignmentEligible` remains false until mandatory profile fields are complete.
- At 100%, the completion reward path is attempted exactly once.

### PRO-03 Upload Photograph

Actor: Company, Professional, Individual

Goal: Confirm profile photo updates and downstream dependencies.

Steps:

1. Upload a profile photo.
2. Save profile.
3. Re-open profile and any dependent feature.

Validate:

- Photo URL persists.
- Bot Hero request prerequisites are satisfied for coaches who require a profile photo.

## 5. Company And Coach Creator Journeys

### CRE-01 Company Creates Coach

Actor: Company

Goal: Confirm scoped creation of a Professional.

Steps:

1. Create a Professional from Company Manage Users.

Validate:

- `associatedCompanyId` is stamped correctly.
- User is created immediately.
- Wallet and initial wallet transaction are created immediately.

### CRE-02 Company Creates Individual

Actor: Company

Goal: Confirm scoped creation of an Individual.

Steps:

1. Create an Individual from Company Manage Users.

Validate:

- User is created under the same tenant.
- Association data is correct.
- Wallet and initial issuance are created immediately.

### CRE-03 Coach Creates Individual

Actor: Professional

Goal: Confirm scoped creation of an Individual by a coach.

Steps:

1. Create an Individual from Professional Manage Users.

Validate:

- `associatedProfessionalId` is set to the creator.
- Wallet and initial issuance are created immediately.

### CRE-04 Company Creates Program And Event

Actor: Company

Goal: Confirm creator-side resource flow for non-SuperAdmin roles.

Steps:

1. Create a Program.
2. Try to publish it.
3. Select a listing package where required.
4. Request promotion with a promotion package.
5. Repeat for Event.

Validate:

- Publish does not go live directly; it becomes a listing approval flow.
- Promote becomes a promotion request rather than direct promotion.
- Wallet credits are checked before promotion request submission.
- Requests appear in SuperAdmin approval queues.

### CRE-05 Coach Creates Program And Event

Actor: Professional

Goal: Confirm creator-side resource flow for coaches.

Steps:

1. Create a Program.
2. Publish it using the listing-package flow.
3. Promote it using the promotion-package flow.
4. Repeat for Event.

Validate:

- Listing package is required for publish intent where applicable.
- Promotion package is required for promotion intent.
- Insufficient credits block promotion request submission.
- Approved requests later surface the resource on the landing page.

## 6. Recommended Regression Order

Run this order first when doing broad manual QA:

1. `SA-01` to `SA-03`
2. `SA-07`
3. `SA-08` to `SA-11`
4. `LAND-01` to `LAND-06`
5. `AUTH-01` to `AUTH-03`
6. `PRO-01` to `PRO-03`
7. `CRE-01` to `CRE-05`

## 7. Minimum Smoke Pack

If only a short smoke pass is possible, run these journeys:

1. `SA-01 Create Tenant And Validate Settings`
2. `SA-03 Ensure Treasury Wallet Exists`
3. `SA-07 Seed Earning Packages`
4. `SA-11 Approve Wallet, Bot, Cashout, Listing, And Promotion Requests`
5. `LAND-02 Toggle Programs Section`
6. `AUTH-02 Register As Coach`
7. `PRO-02 Validate Completion Percentage And Eligibility`
8. `CRE-05 Coach Creates Program And Event`
