import type { AssessmentQuestionRecord } from "@/types/assessment";

/**
 * Contract that every quiz runner must satisfy.
 *
 * - Single-choice runners use currentIndex / onNext / onPrev for navigation.
 * - Self-navigating runners (e.g. InstantFeedbackMultiChoiceQuiz) manage their
 *   own internal scenario index and ignore those props.
 * - All runners call onAnswer(questionId, values[]) to bubble selections up to
 *   the page, and onSubmit() when the participant has completed all interactions.
 */
export type QuizRunnerProps = {
  assessmentName: string;
  tenantId: string;
  questions: AssessmentQuestionRecord[];
  /** Page-level current index — used by single-navigating runners. */
  currentIndex: number;
  /** Values selected per question. Always string[] (single-choice passes 1-item array). */
  answersByQuestionId: Record<string, string[]>;
  onAnswer: (questionId: string, values: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: (pendingAnswer?: { questionId: string; values: string[] }) => void;
  submitting: boolean;
  error: string;
};
