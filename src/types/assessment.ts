import { Timestamp } from "firebase/firestore";

export type AssessmentRenderStyle =
  | "single-choice"
  | "instant-feedback-multi-choice"
  | "select-and-move"
  | "image-based-single-choice"
  | "gamified-drag-drop";

export type AssessmentType =
  | "self-awareness"
  | "capability"
  | "leadership-style"
  | "blind-spots"
  | "readiness"
  | "preferences"
  | "behaviour"
  | "custom";

export type AssessmentStatus = "draft" | "active" | "archived";
export type AssessmentPublicationState = "unpublished" | "published" | "scheduled";
export type AssessmentOwnershipScope = "platform" | "tenant" | "professional";

export type AssessmentRecord = {
  id: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  questionBankCount: number;
  questionsPerAttempt: number;
  analysisPrompt: string;
  questionGenerationPrompt: string;
  status: AssessmentStatus;
  publicationState: AssessmentPublicationState;
  ownershipScope: AssessmentOwnershipScope;
  ownerEntityId: string;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp | null;
};

export type QuestionOption = {
  label: string;
  value: string;
};

export type AssessmentQuestionRecord = {
  id: string;
  assessmentId: string;
  tenantId: string;
  questionText: string;
  questionType: AssessmentRenderStyle;
  renderStyle: AssessmentRenderStyle;
  options: QuestionOption[];
  correctAnswers: string[]; // Array of correct values: ["A"] for single-choice, ["A", "B", "C"] for multi-choice
  scoringRule: string;
  imageUrl: string;
  imageDescription: string;
  displayOrder: number;
  weight: number;
  tags: string[];
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type AssessmentFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  questionBankCount: string;
  questionsPerAttempt: string;
  analysisPrompt: string;
  questionGenerationPrompt: string;
  status: AssessmentStatus;
  publicationState: AssessmentPublicationState;
  ownershipScope: AssessmentOwnershipScope;
  ownerEntityId: string;
};

export const RENDER_STYLE_LABELS: Record<AssessmentRenderStyle, string> = {
  "single-choice": "Single Choice (Radio Buttons)",
  "instant-feedback-multi-choice": "Instant Feedback Multi-Choice",
  "select-and-move": "Select & Move (Select All That Apply)",
  "image-based-single-choice": "Image-Based Single Choice",
  "gamified-drag-drop": "Gamified Drag & Drop",
};

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  "self-awareness": "Self Awareness",
  capability: "Capability",
  "leadership-style": "Leadership Style",
  "blind-spots": "Blind Spots",
  readiness: "Readiness",
  preferences: "Preferences",
  behaviour: "Behaviour",
  custom: "Custom",
};

export type GeneratedQuestion = {
  questionText: string;
  options: QuestionOption[];
  correctAnswers: string[]; // Use array for future extensibility
  scoringRule: string;
  imageDescription?: string;
  tags?: string[];
  weight?: number;
};
