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
  assessmentImageUrl?: string;
  assessmentImagePath?: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  creditsRequired: number;
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

export type AssessmentAttemptStatus = "in_progress" | "completed" | "abandoned";

export type AssessmentAnswerRecord = {
  questionId: string;
  questionText: string;
  /** All values the participant selected. Single-choice = 1-item array. Multi/signal-noise = N items. */
  selectedValues: string[];
  correctAnswers: string[];
  isCorrect: boolean;
};

export type AssessmentAttemptRecord = {
  id: string;
  assessmentId: string;
  tenantId: string;
  userId: string;
  assignmentId: string;
  questionsServed: AssessmentQuestionRecord[];
  answersSubmitted: AssessmentAnswerRecord[];
  rawScore: number;
  rawResultPayload: Record<string, unknown>;
  status: AssessmentAttemptStatus;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
};

export type AssessmentReportRecord = {
  id: string;
  assessmentId: string;
  attemptId: string;
  tenantId: string;
  userId: string;
  assignmentId: string;
  aiProvider: string;
  analysisPromptUsed: string;
  aiResponseRaw: string;
  reportSummary: string;
  reportStructuredData: Record<string, unknown>;
  pdfUrl?: string;
  createdAt?: Timestamp;
};

export type AssessmentFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentImageUrl: string;
  assessmentImagePath: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  creditsRequired: string;
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
  "select-and-move": "Prioritize",
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
