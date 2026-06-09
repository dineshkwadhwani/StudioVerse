import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import {
  listDevelopmentRecommendations,
  syncDevelopmentPlanItemAssignmentStatus,
} from "@/services/development-plans.service";
import type {
  AssessmentAnswerRecord,
  AssessmentAttemptRecord,
  AssessmentRecord,
  AssessmentQuestionRecord,
  AssessmentReportStyle,
  AssessmentReportRecord,
} from "@/types/assessment";
import type { AssignmentRecord } from "@/types/assignment";
import type { CompetencyLevelValue } from "@/types/competency";
import type { DevelopmentPlanRecommendationRecord } from "@/types/development-plan";

export type AssessmentLaunchPayload = {
  assignment: AssignmentRecord;
  assessment: AssessmentRecord;
  questions: AssessmentQuestionRecord[];
};

export type SaveAssessmentCompletionArgs = {
  assignment: AssignmentRecord;
  assessment: {
    id: string;
    name: string;
  };
  questionsServed: AssessmentQuestionRecord[];
  answersSubmitted: AssessmentAnswerRecord[];
  startedAtMs: number;
  reportStyle: AssessmentReportStyle;
  aiProvider: string;
  analysisPromptUsed: string;
  aiResponseRaw: string;
  reportSummary: string;
  reportStructuredData: Record<string, unknown>;
};

export type AssessmentReportRecommendation = DevelopmentPlanRecommendationRecord;

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function toMillis(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const candidate = value as { toMillis?: () => number };
  if (typeof candidate.toMillis !== "function") {
    return 0;
  }

  return candidate.toMillis();
}

function calculateRawScore(answers: AssessmentAnswerRecord[]): number {
  if (answers.length === 0) {
    return 0;
  }

  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  return Math.round((correctCount / answers.length) * 100);
}

export async function getAssessmentLaunchPayload(assignmentId: string): Promise<AssessmentLaunchPayload> {
  const assignmentSnap = await getDoc(doc(db, "assignments", assignmentId));
  if (!assignmentSnap.exists()) {
    throw new Error("Assignment not found.");
  }

  const assignment = {
    id: assignmentSnap.id,
    ...(assignmentSnap.data() as Omit<AssignmentRecord, "id">),
  };

  if (assignment.activityType !== "assessment") {
    throw new Error("This activity is not an assessment.");
  }

  const assessmentSnap = await getDoc(doc(db, "assessments", assignment.activityId));
  if (!assessmentSnap.exists()) {
    throw new Error("Assessment not found.");
  }

  const assessment = {
    id: assessmentSnap.id,
    ...(assessmentSnap.data() as Omit<AssessmentRecord, "id">),
  };

  const questionsSnap = await getDocs(
    query(collection(db, "assessmentQuestions"), where("assessmentId", "==", assessment.id))
  );

  const allQuestions = questionsSnap.docs
    .map((row) => ({
      id: row.id,
      ...(row.data() as Omit<AssessmentQuestionRecord, "id">),
    }))
    .filter((row) => row.isActive !== false);

  if (allQuestions.length === 0) {
    throw new Error("No active questions found for this assessment.");
  }

  const requestedCount = Math.max(1, Number(assessment.questionsPerAttempt) || 1);
  const selectedCount = Math.min(requestedCount, allQuestions.length);
  const randomized = shuffleArray(allQuestions).slice(0, selectedCount);

  return {
    assignment,
    assessment,
    questions: randomized,
  };
}

export async function saveAssessmentCompletion(
  args: SaveAssessmentCompletionArgs
): Promise<{ attemptId: string; reportId: string }> {
  const rawScore = calculateRawScore(args.answersSubmitted);

  const attemptRef = doc(collection(db, "assessmentAttempts"));
  const reportRef = doc(collection(db, "assessmentReports"));
  const assignmentRef = doc(db, "assignments", args.assignment.id);

  const completingUid = auth.currentUser?.uid;
  const reportUserId = completingUid || args.assignment.assigneeId;

  const attemptDoc: Omit<AssessmentAttemptRecord, "id"> = {
    assessmentId: args.assessment.id,
    tenantId: args.assignment.tenantId,
    userId: reportUserId,
    assignmentId: args.assignment.id,
    questionsServed: args.questionsServed,
    answersSubmitted: args.answersSubmitted,
    rawScore,
    rawResultPayload: {
      assessmentName: args.assessment.name,
      questionsPerAttempt: args.questionsServed.length,
      reportStyle: args.reportStyle,
      reportSummary: args.reportSummary,
      reportStructuredData: args.reportStructuredData,
    },
    status: "completed",
  };

  const reportDoc: Omit<AssessmentReportRecord, "id"> = {
    assessmentId: args.assessment.id,
    attemptId: attemptRef.id,
    tenantId: args.assignment.tenantId,
    userId: reportUserId,
    assignmentId: args.assignment.id,
    reportStyle: args.reportStyle,
    aiProvider: args.aiProvider,
    analysisPromptUsed: args.analysisPromptUsed,
    aiResponseRaw: args.aiResponseRaw,
    reportSummary: args.reportSummary,
    reportStructuredData: args.reportStructuredData,
    pdfUrl: "",
  };

  const batch = writeBatch(db);
  batch.set(attemptRef, {
    ...attemptDoc,
    startedAt: new Date(args.startedAtMs),
    completedAt: serverTimestamp(),
  });
  batch.set(reportRef, {
    ...reportDoc,
    createdAt: serverTimestamp(),
  });
  batch.update(assignmentRef, {
    status: "completed",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await syncDevelopmentPlanItemAssignmentStatus({
    tenantId: args.assignment.tenantId,
    subjectUserId: args.assignment.assigneeId,
    assignmentId: args.assignment.id,
    assignmentStatus: "completed",
  });

  return {
    attemptId: attemptRef.id,
    reportId: reportRef.id,
  };
}

export async function getLatestAssessmentReportByAssignmentId(
  assignmentId: string
): Promise<AssessmentReportRecord | null> {
  try {
    const baseQuery = query(
      collection(db, "assessmentReports"),
      where("assignmentId", "==", assignmentId)
    );

    const reportSnap = await getDocs(baseQuery);

    if (reportSnap.empty) {
      return null;
    }

    const reports = reportSnap.docs.map((row) => ({
      id: row.id,
      ...(row.data() as Omit<AssessmentReportRecord, "id">),
    }));

    reports.sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));
    return reports[0] ?? null;
  } catch (error) {
    console.error("[getLatestAssessmentReportByAssignmentId] Error fetching report", {
      timestamp: new Date().toISOString(),
      assignmentId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : "Unknown",
      errorStack: error instanceof Error ? error.stack : "No stack trace",
      fullError: error,
    });
    throw error;
  }
}

function matchesExactValue(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim() && right.trim() && left.trim() === right.trim());
}

function matchesExactValueIgnoreCase(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim() && right.trim() && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function isExactAssessmentRecommendationMatch(
  recommendation: DevelopmentPlanRecommendationRecord,
  assessment: AssessmentRecord
): boolean {
  const categoryMatched = matchesExactValue(recommendation.categoryId, assessment.categoryId)
    || matchesExactValueIgnoreCase(recommendation.categoryName, assessment.categoryName);
  const subCategoryMatched = matchesExactValue(recommendation.subCategoryId, assessment.subCategoryId)
    || matchesExactValueIgnoreCase(recommendation.subCategoryName, assessment.subCategoryName);

  return categoryMatched && subCategoryMatched;
}

function toCompetencyLevelValue(value?: number): CompetencyLevelValue {
  if (value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }

  return 1;
}

export async function getAssessmentReportRecommendations(args: {
  tenantId: string;
  assessmentId: string;
  limit?: number;
}): Promise<AssessmentReportRecommendation[]> {
  const assessmentSnap = await getDoc(doc(db, "assessments", args.assessmentId));
  if (!assessmentSnap.exists()) {
    return [];
  }

  const assessment = {
    id: assessmentSnap.id,
    ...(assessmentSnap.data() as Omit<AssessmentRecord, "id">),
  };

  if (!assessment.categoryId?.trim() || !assessment.subCategoryId?.trim()) {
    return [];
  }

  const recommendations = await listDevelopmentRecommendations({
    tenantId: args.tenantId,
    plan: {
      objectives: [
        {
          categoryId: assessment.categoryId,
          categoryName: assessment.categoryName?.trim() || "",
          subCategoryId: assessment.subCategoryId,
          subCategoryName: assessment.subCategoryName?.trim() || "",
          targetLevel: toCompetencyLevelValue(assessment.competencyLevel),
        },
      ],
    },
  });

  const limit = Math.max(1, args.limit ?? 5);
  return recommendations
    .filter((item) => !(item.activityType === "assessment" && item.activityId === assessment.id))
    .filter((item) => isExactAssessmentRecommendationMatch(item, assessment))
    .slice(0, limit);
}
