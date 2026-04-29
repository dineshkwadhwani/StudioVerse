import { Timestamp } from "firebase/firestore";

export type AssessmentRenderStyle =
  | "forced-trade-off"
  | "gamified-drag-drop"
  | "image-based-single-choice"
  | "single-choice"
  | "instant-feedback-multi-choice"
  | "select-and-move"
  | "likert-rating-scale"
  | "slider-scale";

export type AssessmentType =
  | "self-awareness"
  | "capability"
  | "leadership-style"
  | "blind-spots"
  | "readiness"
  | "preferences"
  | "behaviour"
  | "custom";

export type AssessmentStatus = "draft" | "published" | "archived";
export type AssessmentPublicationState = "unpublished" | "published" | "scheduled";
export type AssessmentOwnershipScope = "platform" | "tenant" | "professional";
export type AssessmentVisibility = "public" | "private";
export type AssessmentPromotionStatus = "none" | "requested" | "promoted";
export type AssessmentReportStyle =
  | "development-template"
  | "diagnostic-template"
  | "capability-scorecard-template"
  | "leadership-readiness-template"
  | "behavioral-pattern-template"
  | "360-influence-template"
  | "growth-journey-template"
  | "executive-coaching-premium-template"
  | "action-centric-template"
  | "psychological-insight-template";

export type AssessmentRecord = {
  id: string;
  tenantId: string;
  tenantIds?: string[];
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentImageUrl?: string;
  assessmentImagePath?: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  reportStyle: AssessmentReportStyle;
  creditsRequired: number;
  questionBankCount: number;
  questionsPerAttempt: number;
  analysisPrompt: string;
  questionGenerationPrompt: string;
  status: AssessmentStatus;
  promoted: boolean;
  promotionPackageId: string | null;
  promotionStatus: AssessmentPromotionStatus;
  publicationState: AssessmentPublicationState;
  visibility: AssessmentVisibility;
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
  reportStyle?: AssessmentReportStyle;
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
  tenantIds: string[];
  name: string;
  shortDescription: string;
  longDescription: string;
  assessmentImageUrl: string;
  assessmentImagePath: string;
  assessmentContext: string;
  assessmentBenefit: string;
  assessmentType: AssessmentType;
  renderStyle: AssessmentRenderStyle;
  reportStyle: AssessmentReportStyle;
  creditsRequired: string;
  questionBankCount: string;
  questionsPerAttempt: string;
  analysisPrompt: string;
  questionGenerationPrompt: string;
  status: AssessmentStatus;
  promoted: boolean;
  promotionPackageId: string;
  promotionStatus: AssessmentPromotionStatus;
  publicationState: AssessmentPublicationState;
  visibility: AssessmentVisibility;
  ownershipScope: AssessmentOwnershipScope;
  ownerEntityId: string;
};

export const RENDER_STYLE_LABELS: Record<AssessmentRenderStyle, string> = {
  "forced-trade-off": "Forced Trade-off",
  "gamified-drag-drop": "Gamified Drag & Drop",
  "image-based-single-choice": "Image-Based Single Choice",
  "instant-feedback-multi-choice": "Instant Feedback Multi-Choice",
  "likert-rating-scale": "Likert / Rating Scale",
  "select-and-move": "Prioritize",
  "single-choice": "Single Choice (Radio Buttons)",
  "slider-scale": "Slider Scale",
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

export const ASSESSMENT_PROMOTION_STATUS_LABELS: Record<AssessmentPromotionStatus, string> = {
  none: "Not Promoted",
  requested: "Promotion Requested",
  promoted: "Promoted",
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
