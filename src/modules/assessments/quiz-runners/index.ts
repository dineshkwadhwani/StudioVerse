import type { ComponentType } from "react";
import type { QuizRunnerProps } from "./types";
import SingleChoiceQuiz from "./SingleChoiceQuiz";
import InstantFeedbackMultiChoiceQuiz from "./InstantFeedbackMultiChoiceQuiz";

export type { QuizRunnerProps } from "./types";

/**
 * Registry mapping renderStyle strings to their runner components.
 *
 * To add a new render style:
 *   1. Create src/modules/assessments/quiz-runners/YourNewQuiz.tsx
 *   2. Add one entry here.
 *   3. Nothing else changes.
 */
const QUIZ_RUNNERS: Record<string, ComponentType<QuizRunnerProps>> = {
  "single-choice": SingleChoiceQuiz,
  "instant-feedback-multi-choice": InstantFeedbackMultiChoiceQuiz,
  // Future runners:
  // "image-based-single-choice": ImageSingleChoiceQuiz,
  // "select-and-move": SelectAndMoveQuiz,
  // "gamified-drag-drop": GamifiedDragDropQuiz,
};

/**
 * Returns the runner component for the given renderStyle, or null if not yet
 * implemented — the launch page shows a "not yet enabled" message in that case.
 */
export function getQuizRunner(renderStyle: string): ComponentType<QuizRunnerProps> | null {
  return QUIZ_RUNNERS[renderStyle] ?? null;
}
