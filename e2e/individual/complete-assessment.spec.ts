/**
 * I-B2 — Individual (Kiran) launches an assigned assessment, answers all
 * questions, submits, and the AI-backed report renders on /assessment-report.
 *
 * The /api/assessments/analyze-attempt route is stubbed via Playwright's
 * page.route so this test doesn't depend on Groq/OpenAI keys or live
 * network calls. The route returns a deterministic JSON payload with the
 * full structured-sections shape expected by AssessmentReportPage.
 *
 * Setup (beforeAll):
 *   • Bootstrap an `assessments` doc (single-choice + development-template,
 *     questionsPerAttempt=2).
 *   • Bootstrap 2 `assessmentQuestions` docs each with two options + one
 *     correct value.
 *   • Bootstrap an `assignments` doc for Kiran with status="assigned".
 *
 * Flow:
 *   1. Stub POST /api/assessments/analyze-attempt → canned structured JSON.
 *   2. Kiran signs in → goto assessment-launch/{assignmentId}.
 *   3. Welcome → "Start Now".
 *   4. For each question: select first radio → Next, last → "Submit Assessment".
 *   5. The page redirects to assessment-report/{assignmentId}; verify
 *      summary text + a section title from our canned payload renders.
 *
 * DB verifies:
 *   • Assignment status flips to "completed".
 *   • An assessmentReports doc exists for this assignmentId.
 *   • An assessmentAttempts doc exists for this assignmentId.
 */

import { test, expect } from "@playwright/test";
import { signInAs } from "../../tests/helpers/playwright-auth";
import { TEST_PHONES } from "../../tests/fixtures/test-phones";
import {
  getAdminDb,
  getUserByPhone,
} from "../../tests/helpers/admin-firestore";
import { FieldValue } from "firebase-admin/firestore";

const INDIVIDUAL = TEST_PHONES.individualAssociated; // Kiran
const ASSIGNER = TEST_PHONES.coachAssociated; // Shilpa as assigner-of-record
const TENANT_ID = "coaching-studio";

const ASSESSMENT_NAME = "E2E Complete Assessment Target";
const Q1_TEXT = "E2E Q1: How do you handle setbacks?";
const Q2_TEXT = "E2E Q2: How do you take feedback?";
const CANNED_SUMMARY = "E2E canned summary — your style is reflective and resilient.";
const CANNED_STRENGTH_ITEM = "Listens with curiosity before judging.";

let individualUserId = "";
let assignerUserId = "";
let assessmentId = "";
let assignmentId = "";
let questionIds: string[] = [];

async function cleanupAllRunArtifacts() {
  const db = getAdminDb();

  // Assignment + report + attempt cleanup (keyed on assignmentId when known).
  if (assignmentId) {
    const reports = await db
      .collection("assessmentReports")
      .where("assignmentId", "==", assignmentId)
      .get();
    for (const d of reports.docs) await d.ref.delete();
    const attempts = await db
      .collection("assessmentAttempts")
      .where("assignmentId", "==", assignmentId)
      .get();
    for (const d of attempts.docs) await d.ref.delete();
    await db.collection("assignments").doc(assignmentId).delete().catch(() => {});
  }

  // Questions and the assessment shell.
  for (const qid of questionIds) {
    await db.collection("assessmentQuestions").doc(qid).delete().catch(() => {});
  }
  if (assessmentId) {
    await db.collection("assessments").doc(assessmentId).delete().catch(() => {});
  }
}

async function bootstrapAssessmentWithQuestions() {
  const db = getAdminDb();

  const assessmentRef = db.collection("assessments").doc();
  await assessmentRef.set({
    tenantId: TENANT_ID,
    tenantIds: [TENANT_ID],
    name: ASSESSMENT_NAME,
    shortDescription: "Two-question E2E single-choice assessment.",
    longDescription: "Used by the I-B2 sanity test only.",
    assessmentImageUrl: "",
    assessmentImagePath: "",
    assessmentContext: "E2E test of the complete-assessment flow.",
    assessmentBenefit: "Validates the launch → quiz → submit → report path.",
    assessmentType: "self-assessment",
    renderStyle: "single-choice",
    reportStyle: "development-template",
    creditsRequired: 0,
    questionBankCount: 2,
    questionsPerAttempt: 2,
    analysisPrompt: "Analyze the response set briefly.",
    questionGenerationPrompt: "",
    status: "published",
    promoted: false,
    promotionPackageId: null,
    promotionStatus: "none",
    listingPackageId: null,
    listingStatus: "none",
    publicationState: "published",
    visibility: "public",
    ownershipScope: "platform",
    ownerEntityId: "platform",
    createdBy: "e2e",
    updatedBy: "e2e",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  assessmentId = assessmentRef.id;

  const qDefs = [
    {
      questionText: Q1_TEXT,
      options: [
        { value: "a", label: "I reframe quickly and re-plan." },
        { value: "b", label: "I freeze and need time to recover." },
      ],
      correctAnswers: ["a"],
      displayOrder: 1,
    },
    {
      questionText: Q2_TEXT,
      options: [
        { value: "a", label: "I look for the kernel of truth." },
        { value: "b", label: "I defend my position first." },
      ],
      correctAnswers: ["a"],
      displayOrder: 2,
    },
  ];

  questionIds = [];
  for (const q of qDefs) {
    const qRef = db.collection("assessmentQuestions").doc();
    await qRef.set({
      assessmentId,
      tenantId: TENANT_ID,
      questionText: q.questionText,
      questionType: "single-choice",
      renderStyle: "single-choice",
      options: q.options,
      correctAnswers: q.correctAnswers,
      scoringRule: "exact-match",
      imageUrl: "",
      imageDescription: "",
      displayOrder: q.displayOrder,
      weight: 1,
      tags: [],
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    questionIds.push(qRef.id);
  }

  // Assignment doc.
  const assignRef = db.collection("assignments").doc();
  await assignRef.set({
    tenantId: TENANT_ID,
    activityType: "assessment",
    activityId: assessmentId,
    activityTitle: ASSESSMENT_NAME,
    creditsRequired: 0,
    assignerId: assignerUserId,
    assignerName: ASSIGNER.fullName,
    assigneeId: individualUserId,
    assigneePhone: `+91${INDIVIDUAL.number}`,
    assigneeEmail: "",
    assigneeFirstName: INDIVIDUAL.fullName.split(" ")[0],
    assigneeLastName: INDIVIDUAL.fullName.split(" ").slice(1).join(" "),
    assigneeFullName: INDIVIDUAL.fullName,
    status: "assigned",
    coinsDeducted: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  assignmentId = assignRef.id;
}

test.describe("Individual · My Activities · Launch + Complete Assessment", () => {
  test.beforeAll(async () => {
    const [individual, assigner] = await Promise.all([
      getUserByPhone(INDIVIDUAL.number),
      getUserByPhone(ASSIGNER.number),
    ]);
    if (!individual || !assigner) throw new Error("Required fixture users missing.");
    individualUserId = individual.id;
    assignerUserId = assigner.id;
  });

  test.afterAll(async () => {
    await cleanupAllRunArtifacts();
  });

  test.beforeEach(async () => {
    await cleanupAllRunArtifacts();
    await bootstrapAssessmentWithQuestions();
  });

  test("Kiran completes a single-choice assessment and the report page renders", async ({
    page,
  }) => {
    // Stub the AI analysis route so we don't depend on Groq/OpenAI.
    await page.route("**/api/assessments/analyze-attempt", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          aiProvider: "e2e-stub",
          raw: "{}",
          summary: CANNED_SUMMARY,
          effectiveAnalysisPrompt: "stubbed prompt",
          structured: {
            reportStyle: "development-template",
            sections: [
              { key: "strengths", items: [CANNED_STRENGTH_ITEM, "Adapts under pressure."] },
              { key: "blind-spots", items: ["Sometimes overcommits."] },
              { key: "recommendations", items: ["Schedule weekly reflection."] },
              { key: "next-actions", items: ["Block 30 minutes Friday for review."] },
            ],
          },
        }),
      });
    });

    await signInAs(page, "individualAssociated");

    // Direct-launch URL — bypasses needing to click through My Activities.
    await page.goto(`/coaching-studio/my-activities/assessment-launch/${assignmentId}`, {
      waitUntil: "domcontentloaded",
    });

    // Welcome card → Start Now.
    await expect(page.getByRole("button", { name: /^Start Now$/ })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Start Now$/ }).click();

    // Q1: select first option and go Next.
    await expect(page.getByText(Q1_TEXT, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.locator(`input[type="radio"]`).first().check();
    await page.getByRole("button", { name: /^Next Question →$/ }).click();

    // Q2: select first option and submit.
    await expect(page.getByText(Q2_TEXT, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.locator(`input[type="radio"]`).first().check();
    await page.getByRole("button", { name: /^Submit Assessment$/ }).click();

    // Wait for redirect to the report page.
    await page.waitForURL(new RegExp(`/assessment-report/${assignmentId}`), { timeout: 30_000 });

    // The summary from our stub should appear on the page.
    await expect(page.getByText(CANNED_SUMMARY)).toBeVisible({ timeout: 30_000 });
    // And at least one section item from the canned payload.
    await expect(page.getByText(CANNED_STRENGTH_ITEM)).toBeVisible({ timeout: 15_000 });

    // ── DB verification ───────────────────────────────────────────────
    const db = getAdminDb();
    const assignmentSnap = await db.collection("assignments").doc(assignmentId).get();
    expect(String(assignmentSnap.data()?.status ?? "")).toBe("completed");

    const reportSnap = await db
      .collection("assessmentReports")
      .where("assignmentId", "==", assignmentId)
      .get();
    expect(reportSnap.docs, "expected one assessmentReports doc").toHaveLength(1);
    expect(String(reportSnap.docs[0]!.data().reportSummary ?? "")).toBe(CANNED_SUMMARY);

    const attemptSnap = await db
      .collection("assessmentAttempts")
      .where("assignmentId", "==", assignmentId)
      .get();
    expect(attemptSnap.docs, "expected one assessmentAttempts doc").toHaveLength(1);
    expect(String(attemptSnap.docs[0]!.data().status ?? "")).toBe("completed");
  });
});
