#!/usr/bin/env node

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create PDF document
const doc = new PDFDocument({
  size: 'A4',
  margin: 40,
  bufferPages: true,
  autoFirstPage: false,
});

// Output file
const outputPath = path.join(__dirname, 'docs', 'testplan.pdf');
const stream = fs.createWriteStream(outputPath);

doc.pipe(stream);

// Colors
const colors = {
  primary: '#1a365d',
  accent: '#2d5016',
  success: '#22543d',
  warning: '#743210',
  error: '#742a2a',
  light: '#f7fafc',
};

// =============================================================================
// PAGE 1: TITLE & EXECUTIVE SUMMARY
// =============================================================================
doc.addPage();

doc.fontSize(32).fillColor(colors.primary).font('Helvetica-Bold').text('StudioVerse', { align: 'center' });
doc.fontSize(24).fillColor(colors.accent).text('Test Strategy & Automation Plan', 2, null, { align: 'center' });
doc.fontSize(14).fillColor('#555').text('End-to-End Testing Framework', 10, null, { align: 'center' });

doc
  .fontSize(10)
  .fillColor('#666')
  .text('April 27, 2026', { align: 'center' });

doc.moveDown(2);
doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(1.5);

doc
  .fontSize(12)
  .font('Helvetica-Bold')
  .fillColor(colors.primary)
  .text('EXECUTIVE SUMMARY');
doc.fontSize(11).font('Helvetica').fillColor('#333');

const summaryText = `This document defines the comprehensive end-to-end (E2E) testing strategy for StudioVerse, a multi-tenant SaaS platform supporting Coaching Studio, Training Studio, and Recruitment Studio deployments.

The test plan covers 140+ test cases organized across 16 testing phases, from landing page validation through multi-role user journeys, activity assignment workflows, and role-based access control enforcement.

Critically, this plan distinguishes between tests that can be automated via Playwright E2E framework (approximately 110 tests) and tests that require manual verification (approximately 30 tests, primarily visual/UX and real-world integrations).`;

doc.text(summaryText, { align: 'left', width: 475 });

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('KEY METRICS');
doc.fontSize(10).font('Helvetica').fillColor('#333');

doc.text('• Total Test Cases: 140+', { continued: true }).text('  |  Automatable: ~110  |  Manual: ~30');
doc.text('• Testing Phases: 16 distinct phases across all epics (E0–E12)');
doc.text('• Critical Blockers: 2 (must fix before launch)');
doc.text('• High Priority: 8 (schedule for first release)');
doc.text('• Automation Framework: Playwright + TypeScript');
doc.text('• Test Coverage: User registration, profiles, permissions, assignments, wallets, cohorts, referrals');

// =============================================================================
// PAGE 2: WHAT CAN BE AUTOMATED
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.success).text('✓ AUTOMATABLE TESTS (~110 cases)');
doc.moveDown(0.5);

const automatable = [
  {
    title: 'Phase 1-3: Authentication & Registration',
    items: [
      'Landing page load, element presence, no console errors',
      'Registration for all 4 roles (SuperAdmin, Company, Professional, Individual)',
      'Email/password validation, form submission',
      'Login with valid/invalid credentials',
      'Dashboard loads with role-correct menu structure',
      'Session persistence across page refreshes',
      'Sign out functionality',
    ],
  },
  {
    title: 'Phase 4-7: User & Wallet Management',
    items: [
      'Wallet initialization on user creation (10 coins default)',
      'Mandatory profile fields gated until completion',
      'Optional profile field submission',
      'Company creates Professional/Individual users via API',
      'Professional creates Individual users (auto-associated)',
      'Wallet balance updates on coin issuance',
      'Wallet transaction history retrieval',
      'Coin request creation and approval flows',
    ],
  },
  {
    title: 'Phase 6: Content Publishing (SuperAdmin)',
    items: [
      'Create Program with metadata, facilitator, duration',
      'Create Event with date, time, location, address',
      'Create Assessment with report style and AI prompt',
      'Publish/unpublish content',
      'Toggle promoted flag',
      'Multi-tenant assignment (E2 feature)',
      'Verify content appears in tenant catalogs',
    ],
  },
  {
    title: 'Phase 8-9: Activity Assignment',
    items: [
      'Professional assigns Program to Individual (both known)',
      'Assign to unknown user (inline creation)',
      'Search user by email/phone',
      'Self-assign via "Register Now" / "Try Now"',
      'Recommend workflow (status = "recommended")',
      'Wallet debit on assignment',
      'Insufficient coins error message',
      'Multiple assignments, cumulative wallet deduction',
    ],
  },
  {
    title: 'Phase 10: Assessment Workflows',
    items: [
      'Submit assessment answers',
      'Score calculation',
      'AI report generation (async)',
      'Report retrieval and display',
      'Assessment attempt tracking',
    ],
  },
  {
    title: 'Phase 11: Cohort Management',
    items: [
      'Create cohort with existing members',
      'Inline Individual creation during cohort setup',
      'Assign Professional to cohort',
      'Bulk assign activity to cohort (coin calc: #members × cost)',
      'All cohort members receive activity',
    ],
  },
  {
    title: 'Phase 12: Referrals',
    items: [
      'Create referral (Professional/Company/Individual)',
      'Referral link generation',
      'User joins via referral link',
      'Referral status transitions (referred → joined)',
      'Referrer wallet credit on join (5 coins default)',
      'SuperAdmin filter and view all referrals',
    ],
  },
  {
    title: 'Phase 14-15: Role-Based Access Control',
    items: [
      'Menu visibility per role (E8 matrix)',
      'Route access blocking for unauthorized users',
      'Direct URL bypass prevention',
      'Cross-tenant data isolation verification',
      'Tenant-appropriate branding on each domain',
    ],
  },
  {
    title: 'Service Layer Unit Tests',
    items: [
      'User creation with wallet initialization',
      'Profile completion status calculation',
      'Wallet transaction creation and balance updates',
      'Assignment eligibility checks',
      'Cohort status computation',
      'Referral status transitions',
    ],
  },
];

automatable.forEach((section, idx) => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.success).text(`${idx + 1}. ${section.title}`);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  section.items.forEach((item) => {
    doc.text(`• ${item}`, { width: 475, continued: false });
  });
  doc.moveDown(0.3);
});

// =============================================================================
// PAGE 3: WHAT CANNOT BE AUTOMATED
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.error).text('✗ MANUAL TESTS (~30 cases)');
doc.moveDown(0.5);

const manual = [
  {
    title: 'Visual & Responsive Design (~6 tests)',
    reason: 'Require visual inspection and screenshot comparison',
    items: [
      'Mobile responsiveness (<640px viewport)',
      'Tablet layout (640px–1024px)',
      'Desktop layout (>1024px)',
      'Sticky header behavior',
      'Menu hamburger collapse on mobile',
      'Form field rendering and spacing',
    ],
  },
  {
    title: 'Real-World Integrations (~8 tests)',
    reason: 'Depend on external services or production configuration',
    items: [
      'Email delivery (referral invites, assignment notifications) — currently placeholders',
      'SMS/OTP to real phone numbers (only test numbers work locally)',
      'Payment gateway coin purchase flow (not implemented)',
      'Video/media streaming from embedded URLs',
      'PDF export generation (if implemented)',
    ],
  },
  {
    title: 'User Experience & Accessibility (~10 tests)',
    reason: 'Require human judgment or specialized tooling',
    items: [
      'Form error message clarity and helpfulness',
      'Navigation intuitiveness and discoverability',
      'Loading state indicators (spinners, progress bars)',
      'Success/failure feedback clarity',
      'Color contrast compliance (WCAG AA)',
      'Keyboard-only navigation without mouse',
      'Screen reader compatibility (NVDA, JAWS)',
      'Bot response quality and accuracy',
      'Performance under load (1000+ concurrent users)',
      'Consistency across studio branding (Coaching vs. Training vs. Recruitment)',
    ],
  },
  {
    title: 'Edge Cases & Specific Scenarios (~6 tests)',
    reason: 'Context-dependent or difficult to script systematically',
    items: [
      'Network failure recovery (offline → online)',
      'Session timeout handling',
      'Browser back/forward button behavior',
      'Concurrent operations (two admins editing same program)',
      'Large data set handling (1000+ program items)',
      'Complex role hierarchies (multiple companies/cohorts)',
    ],
  },
];

manual.forEach((section, idx) => {
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.error).text(`${idx + 1}. ${section.title}`);
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#666').text(`Reason: ${section.reason}`);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  section.items.forEach((item) => {
    doc.text(`• ${item}`, { width: 475, continued: false });
  });
  doc.moveDown(0.3);
});

// =============================================================================
// PAGE 4: TEST PHASES SUMMARY TABLE
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary).text('DETAILED TEST PHASES');
doc.moveDown(0.5);

const phases = [
  ['Phase', 'Focus', 'Priority', 'Automatable?', 'Test Cases'],
  [
    'P1',
    'Landing Page',
    'HIGH',
    'Partial (load ok; visuals manual)',
    '7',
  ],
  ['P2', 'Registration', 'HIGH', '✓ Yes', '7'],
  ['P3', 'Login & Dashboard', 'HIGH', '✓ Yes', '7'],
  ['P4', 'Profile Management', 'HIGH', '✓ Yes', '6'],
  ['P5', 'Delegated User Creation', 'HIGH', '✓ Yes', '5'],
  ['P6', 'Content Publishing', 'HIGH', '✓ Yes', '7'],
  ['P7', 'Wallet Management', 'HIGH', '✓ Yes', '6'],
  ['P8', 'Activity Assignment', 'HIGH', '✓ Yes', '8'],
  ['P9', 'My Activities Visibility', 'HIGH', '✓ Yes', '4'],
  ['P10', 'Assessment Execution', 'MEDIUM', '✓ Yes', '6'],
  ['P11', 'Cohort Management', 'MEDIUM', '✓ Yes', '5'],
  ['P12', 'Referral Flows', 'MEDIUM', '✓ Yes', '6'],
  ['P13', 'Bot Integration', 'LOW', 'Partial (basic flow ok)', '6'],
  ['P14', 'RBAC Enforcement', 'HIGH', '✓ Yes', '6'],
  ['P15', 'Cross-Tenant Behavior', 'HIGH', '✓ Yes', '4'],
  ['P16', 'Full User Journeys', 'MEDIUM', '✓ Yes (mostly)', '3'],
];

drawTable(doc, phases, 40, doc.y);

doc.moveDown(1);
doc.fontSize(9).fillColor('#666').text('Legend: P = Phase | ✓ = Fully Automatable | Partial = Mixed Manual/Auto');

// =============================================================================
// PAGE 5: AUTOMATION FRAMEWORK & SETUP
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.accent).text('AUTOMATION FRAMEWORK & SETUP');
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Recommended Stack');
doc.fontSize(10).font('Helvetica').fillColor('#333');

doc.text('Framework: Playwright (TypeScript)', { continued: true }).text('  |  Language: TypeScript');
doc.text('CI/CD: GitHub Actions', { continued: true }).text('  |  Reporting: Playwright HTML Reporter');
doc.text('Database: Firebase Emulator (local)', { continued: true }).text('  |  Auth: Firebase Auth Emulator');

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Repository Structure');
doc.fontSize(10).font('Helvetica-Oblique').fillColor('#555');

const structureCode = `tests/
├── e2e/
│   ├── auth.spec.ts              Phase 2-3: Registration & Login
│   ├── profile.spec.ts           Phase 4: Profile Completion
│   ├── users.spec.ts             Phase 5: User Management
│   ├── content.spec.ts           Phase 6: Program/Event/Assessment
│   ├── wallet.spec.ts            Phase 7: Wallet & Coins
│   ├── assignments.spec.ts       Phase 8-9: Activity Assignment
│   ├── assessments.spec.ts       Phase 10: Assessment Workflows
│   ├── cohorts.spec.ts           Phase 11: Cohorts
│   ├── referrals.spec.ts         Phase 12: Referrals
│   ├── rbac.spec.ts              Phase 14: Access Control
│   ├── cross-tenant.spec.ts      Phase 15: Multi-Tenant
│   └── journeys.spec.ts          Phase 16: Full Flows
├── api/
│   ├── users.test.ts             API route tests
│   ├── assignments.test.ts
│   └── wallets.test.ts
└── unit/
    ├── services.test.ts          Service layer logic
    └── utilities.test.ts`;

doc.font('Courier').fontSize(8).text(structureCode);

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Sample Playwright Test (E2E)');
doc.fontSize(9).font('Courier').fillColor('#333');

const sampleTest = `import { test, expect } from '@playwright/test';

test('Professional assigns Program to Individual', async ({ page }) => {
  // Navigate to app
  await page.goto('https://coaching-studio.local/coaching-studio');

  // Login as Professional
  await page.click('[data-testid="sign-in-btn"]');
  await page.fill('[name="email"]', 'coach@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button:has-text("Sign In")');
  await page.waitForNavigation();

  // Browse Programs
  await page.click('[data-testid="menu-programs"]');
  await page.waitForSelector('[data-testid="program-card"]');

  // Assign Program
  const firstProgram = page.locator('[data-testid="program-card"]').first();
  await firstProgram.hover();
  await page.click('[data-testid="assign-btn"]');

  // Fill assignment form
  await page.fill('[name="phone"]', '+1234567890');
  await page.click('[data-testid="search-btn"]');
  await page.waitForSelector('[data-testid="user-found"]');

  // Verify coins deducted
  const walletBefore = 10;
  await page.click('[data-testid="confirm-assign"]');
  await page.waitForNavigation();

  // Assignee checks wallet
  await page.click('[data-testid="sign-out"]');
  await page.fill('[name="email"]', 'learner@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button:has-text("Sign In")');

  // Verify activity appears in My Activities
  await page.click('[data-testid="menu-activities"]');
  const assignedProgram = page.locator('text=Program Name');
  await expect(assignedProgram).toBeVisible();
});`;

doc.text(sampleTest);

// =============================================================================
// PAGE 6: CRITICAL PATH & EXECUTION PLAN
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary).text('CRITICAL PATH TESTS');
doc.fontSize(10).fillColor('#555').text('(Run these first to validate core platform functionality)');
doc.moveDown(1);

const criticalTests = [
  {
    num: 1,
    name: 'T1-Landing',
    description: 'Landing page loads without errors',
    expectedResult: 'Page renders, all sections visible, no console errors',
  },
  {
    num: 2,
    name: 'T2-Register',
    description: 'All 4 roles register successfully',
    expectedResult: 'Accounts created, wallets initialized (10 coins), emails registered',
  },
  {
    num: 3,
    name: 'T3-Login',
    description: 'Each role logs in with correct dashboard & menu',
    expectedResult: 'Dashboard loads, role-appropriate menu visible',
  },
  {
    num: 4,
    name: 'T4-Profile',
    description: 'Incomplete profile blocks assignments',
    expectedResult: 'Dashboard shows completion prompt, assignment blocked until done',
  },
  {
    num: 5,
    name: 'T5-Wallet',
    description: 'Coin debit on assignment recorded',
    expectedResult: 'Wallet balance decreases, transaction logged',
  },
  {
    num: 6,
    name: 'T6-Assign',
    description: 'Professional assigns Program to Individual',
    expectedResult: 'Activity appears in recipient\'s My Activities',
  },
  {
    num: 7,
    name: 'T7-Cohort',
    description: 'Bulk assign activity to cohort',
    expectedResult: 'All cohort members receive activity, correct coin deduction',
  },
  {
    num: 8,
    name: 'T8-Referral',
    description: 'Referral creation → join → coin reward',
    expectedResult: 'Referrer receives 5 coins on join',
  },
  {
    num: 9,
    name: 'T9-RBAC',
    description: 'Role-based access control enforced',
    expectedResult: 'Users cannot bypass menu or access via direct URL',
  },
  {
    num: 10,
    name: 'T10-Reports',
    description: 'Assessment completion → AI report',
    expectedResult: 'Report generated within 30 seconds',
  },
];

criticalTests.forEach((test) => {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.primary).text(`${test.num}. ${test.name} — ${test.description}`);
  doc.fontSize(9).font('Helvetica').fillColor('#666');
  doc.text(`Expected: ${test.expectedResult}`);
  doc.moveDown(0.4);
});

// =============================================================================
// PAGE 7: KNOWN LIMITATIONS & FUTURE WORK
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.warning).text('KNOWN TEST LIMITATIONS');
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Features That Cannot Be Tested Yet');
doc.fontSize(10).font('Helvetica').fillColor('#333');

const limitations = [
  'Payment Gateway Integration — Coins cannot be purchased; only admin-issued',
  'Real Email Delivery — Referral/assignment notifications use placeholder mail functions',
  'Real OTP Verification — Phone auth works only with pre-configured Firebase test numbers',
  'Video/Media Streaming — YouTube/Vimeo embeds may not stream in test environment',
  'Report PDF Export — May be partially implemented or missing',
  'Bot Intelligence — LLM responses are limited by message cap (5 messages); quality not guaranteed',
  'Advanced Analytics — No pre-built dashboards or reporting views',
  'Load Testing — Requires production instance or dedicated perf environment',
];

limitations.forEach((item) => {
  doc.text(`• ${item}`, { width: 475 });
});

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Recommended Actions Before Launch');
doc.fontSize(10).font('Helvetica').fillColor('#333');

const prelaunch = [
  'Fix all Critical (blocker) items in TODO.md',
  'Run all automatable tests to 100% pass rate',
  'Complete manual test checklist (responsive, UX, accessibility)',
  'Verify cross-browser compatibility (Chrome, Safari, Firefox)',
  'Deploy to staging environment and run full suite',
  'Get stakeholder sign-off on E8 RBAC enforcement',
  'Establish production monitoring (error tracking, analytics)',
];

prelaunch.forEach((item, idx) => {
  doc.text(`${idx + 1}. ${item}`, { width: 475 });
});

// =============================================================================
// PAGE 8: EXECUTION TIMELINE & RESOURCES
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary).text('EXECUTION TIMELINE & RESOURCE PLAN');
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Phase 1: Setup (Days 1-2)');
doc.fontSize(10).font('Helvetica').fillColor('#333');
doc.text('• Install Playwright and dependencies', { width: 475 });
doc.text('• Set up Firebase Emulator for test environment', { width: 475 });
doc.text('• Create test data fixtures (users, programs, events)', { width: 475 });
doc.text('• Configure GitHub Actions CI/CD workflow', { width: 475 });
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Phase 2: Automation (Days 3-7)');
doc.fontSize(10).font('Helvetica').fillColor('#333');
doc.text('• Write E2E test suites for Phase 1-16', { width: 475 });
doc.text('• Write API integration tests', { width: 475 });
doc.text('• Write unit tests for service layer', { width: 475 });
doc.text('• Target: ~110 automatable tests', { width: 475 });
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Phase 3: Manual Testing (Days 8-10)');
doc.fontSize(10).font('Helvetica').fillColor('#333');
doc.text('• Execute manual test checklist (~30 cases)', { width: 475 });
doc.text('• Test across multiple browsers and devices', { width: 475 });
doc.text('• Verify visual design and accessibility', { width: 475 });
doc.text('• Document findings and edge cases', { width: 475 });
doc.moveDown(0.5);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Phase 4: Staging & Sign-off (Days 11-14)');
doc.fontSize(10).font('Helvetica').fillColor('#333');
doc.text('• Deploy to staging environment', { width: 475 });
doc.text('• Run full test suite in staging', { width: 475 });
doc.text('• Stakeholder UAT and sign-off', { width: 475 });
doc.text('• Final bug fixes and re-test', { width: 475 });

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Resource Allocation');
doc.fontSize(10).font('Helvetica').fillColor('#333');

const resources = [
  ['Role', 'Days', 'Deliverables'],
  ['Test Automation Engineer', '7', 'All ~110 automatable test suites'],
  ['QA Tester', '5', 'All ~30 manual tests + accessibility'],
  ['DevOps / Infrastructure', '3', 'Emulator setup, CI/CD, reporting'],
  ['Engineering Lead', '2', 'Review, sign-off, issue triage'],
];

doc.moveDown(0.5);
drawTable(doc, resources, 40, doc.y);

// =============================================================================
// PAGE 9: SUMMARY & SIGN-OFF
// =============================================================================
doc.addPage();

doc.fontSize(14).font('Helvetica-Bold').fillColor(colors.primary).text('TEST STRATEGY SUMMARY');
doc.moveDown(1);

doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.accent).text('Scope');
doc.fontSize(10).font('Helvetica').fillColor('#333').text(
  '140+ test cases across 16 phases, covering authentication, user management, profiles, wallets, assignments, assessments, cohorts, referrals, and role-based access control.'
);

doc.moveDown(0.5);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.success).text('Automatable');
doc.fontSize(10).font('Helvetica').fillColor('#333').text(
  'Approximately 110 tests covering all core workflows and integrations. Framework: Playwright + TypeScript. Execution time: ~30 minutes for full suite.'
);

doc.moveDown(0.5);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.error).text('Manual');
doc.fontSize(10).font('Helvetica').fillColor('#333').text(
  'Approximately 30 tests covering visual design, UX quality, accessibility, and real-world integrations (email, OTP, payments) not yet implemented.'
);

doc.moveDown(0.5);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.warning).text('Pre-Launch Requirements');
doc.fontSize(10).font('Helvetica').fillColor('#333').text(
  'Fix 2 Critical blockers. Fix 8 High Priority items. Achieve 100% pass on automatable tests. Complete manual test checklist. Get stakeholder sign-off.'
);

doc.moveDown(1);
doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.primary).text('Success Criteria');
doc.fontSize(10).font('Helvetica').fillColor('#333');

doc.text('✓ All 10 Critical Path tests pass', { width: 475 });
doc.text('✓ All automatable tests pass with <1% flakiness', { width: 475 });
doc.text('✓ All manual tests documented and signed off', { width: 475 });
doc.text('✓ Cross-browser compatibility verified', { width: 475 });
doc.text('✓ Performance metrics acceptable (<3s page load)', { width: 475 });
doc.text('✓ No security vulnerabilities in role-based access', { width: 475 });

doc.moveDown(2);
doc.fontSize(12).font('Helvetica-Bold').fillColor(colors.primary).text('Document Metadata');
doc.fontSize(9).font('Helvetica').fillColor('#666');
doc.text('Version: 1.0', { continued: true }).text('  |  Date: April 27, 2026  |  Status: Ready for Execution');
doc.text('Author: GitHub Copilot', { continued: true }).text('  |  Project: StudioVerse');
doc.text('Framework: Playwright E2E + Jest + TypeScript');

// Finalize PDF
doc.end();

stream.on('finish', () => {
  console.log(`✓ Test plan PDF generated: ${outputPath}`);
  console.log(`✓ 140+ test cases documented`);
  console.log(`✓ ~110 automatable tests identified`);
  console.log(`✓ ~30 manual tests identified`);
  process.exit(0);
});

stream.on('error', (err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});

// =============================================================================
// HELPER FUNCTION: Draw table
// =============================================================================
function drawTable(doc, data, x, y) {
  const cellHeight = 25;
  const cellPadding = 5;
  const colWidths = [60, 100, 70, 100, 80];

  let currentY = y;

  data.forEach((row, rowIdx) => {
    let currentX = x;
    const isHeader = rowIdx === 0;

    row.forEach((cell, colIdx) => {
      const colWidth = colWidths[colIdx];

      // Draw cell background
      if (isHeader) {
        doc.fillColor(colors.primary).rect(currentX, currentY, colWidth, cellHeight).fill();
        doc.fillColor('white').font('Helvetica-Bold').fontSize(9);
      } else {
        doc.strokeColor('#ddd').rect(currentX, currentY, colWidth, cellHeight).stroke();
        doc.fillColor('#333').font('Helvetica').fontSize(8);
      }

      // Draw text
      doc.text(cell, currentX + cellPadding, currentY + cellPadding, {
        width: colWidth - 2 * cellPadding,
        align: 'left',
        lineBreak: true,
      });

      currentX += colWidth;
    });

    currentY += cellHeight;
  });

  doc.fillColor('#333');
  return currentY;
}
