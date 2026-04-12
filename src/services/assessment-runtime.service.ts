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
import { db } from "@/services/firebase";
import type {
  AssessmentAnswerRecord,
  AssessmentAttemptRecord,
  AssessmentRecord,
  AssessmentQuestionRecord,
  AssessmentReportRecord,
} from "@/types/assessment";
import type { AssignmentRecord } from "@/types/assignment";

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
  aiProvider: string;
  analysisPromptUsed: string;
  aiResponseRaw: string;
  reportSummary: string;
  reportStructuredData: Record<string, unknown>;
};

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

  const attemptDoc: Omit<AssessmentAttemptRecord, "id"> = {
    assessmentId: args.assessment.id,
    tenantId: args.assignment.tenantId,
    userId: args.assignment.assigneeId,
    assignmentId: args.assignment.id,
    questionsServed: args.questionsServed,
    answersSubmitted: args.answersSubmitted,
    rawScore,
    rawResultPayload: {
      assessmentName: args.assessment.name,
      questionsPerAttempt: args.questionsServed.length,
      reportSummary: args.reportSummary,
      reportStructuredData: args.reportStructuredData,
    },
    status: "completed",
  };

  const reportDoc: Omit<AssessmentReportRecord, "id"> = {
    assessmentId: args.assessment.id,
    attemptId: attemptRef.id,
    tenantId: args.assignment.tenantId,
    userId: args.assignment.assigneeId,
    assignmentId: args.assignment.id,
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

  return {
    attemptId: attemptRef.id,
    reportId: reportRef.id,
  };
}

export async function getLatestAssessmentReportByAssignmentId(
  assignmentId: string
): Promise<AssessmentReportRecord | null> {
  const reportSnap = await getDocs(
    query(collection(db, "assessmentReports"), where("assignmentId", "==", assignmentId))
  );

  if (reportSnap.empty) {
    return null;
  }

  const reports = reportSnap.docs.map((row) => ({
    id: row.id,
    ...(row.data() as Omit<AssessmentReportRecord, "id">),
  }));

  reports.sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));
  return reports[0] ?? null;
}
