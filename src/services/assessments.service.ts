import {httpsCallable} from "firebase/functions";
import {functions} from "@/services/firebase";
import type {GeneratedQuestion} from "@/types/assessment";

export type AssessmentQuestionWriteInput = GeneratedQuestion;

export type AssessmentWriteInput = {
  id?: string;
  tenantId: string;
  tenantIds: string[];
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentImageUrl: string;
  assessmentImagePath: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: string;
  renderStyle: string;
  reportStyle: string;
  creditsRequired: number;
  questionBankCount: number;
  questionsPerAttempt: number;
  analysisPrompt: string;
  questionGenerationPrompt: string;
  status: "draft" | "published" | "archived";
  promoted: boolean;
  promotionPackageId: string | null;
  promotionStatus: "none" | "requested" | "promoted";
  publicationState: "unpublished" | "published" | "scheduled";
  visibility: "public" | "private";
  ownershipScope: "platform" | "tenant" | "professional";
  ownerEntityId: string;
  generatedQuestions: AssessmentQuestionWriteInput[];
  existingQuestionCount?: number;
};

const createAssessmentCallable = httpsCallable<Record<string, unknown>, {id: string; status: string}>(
  functions,
  "createAssessment",
);
const updateAssessmentCallable = httpsCallable<Record<string, unknown>, {id: string; status: string}>(
  functions,
  "updateAssessment",
);

function sanitizePayload(input: AssessmentWriteInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...input,
    promotionPackageId: input.promotionPackageId,
  };

  if (!payload.id) {
    delete payload.id;
  }

  return payload;
}

export async function createAssessment(input: AssessmentWriteInput): Promise<{id: string}> {
  const result = await createAssessmentCallable(sanitizePayload(input));
  return {id: result.data.id};
}

export async function updateAssessment(input: AssessmentWriteInput): Promise<{id: string}> {
  if (!input.id) {
    throw new Error("updateAssessment requires an assessment id.");
  }

  const result = await updateAssessmentCallable(sanitizePayload(input));
  return {id: result.data.id};
}

export async function saveAssessmentDefinition(input: AssessmentWriteInput, isExisting: boolean): Promise<{id: string}> {
  return isExisting ? updateAssessment(input) : createAssessment(input);
}
