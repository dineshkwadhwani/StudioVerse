"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getAssessmentLaunchPayload,
  saveAssessmentCompletion,
} from "@/services/assessment-runtime.service";
import { getQuizRunner } from "@/modules/assessments/quiz-runners";
import type { AssessmentQuestionRecord, AssessmentAnswerRecord } from "@/types/assessment";
import type { AssignmentRecord } from "@/types/assignment";

type LaunchState = {
  assignment: AssignmentRecord;
  assessmentName: string;
  shortDescription: string;
  longDescription: string;
  assessmentImageUrl: string;
  renderStyle: string;
  assessmentContext: string;
  assessmentBenefit: string;
  analysisPrompt: string;
  questions: AssessmentQuestionRecord[];
};

type AssessmentPhase = "welcome" | "quiz";

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

/**
 * Build per-question answer text to send to the AI analysis route.
 * - single-choice: "Selected: [label]"
 * - instant-feedback-multi-choice: rich per-scenario signal/noise breakdown
 * - select-and-move / gamified-drag-drop: prioritization order with strategic explanation
 */
function buildAnswersForApi(
  questions: AssessmentQuestionRecord[],
  answersByQuestionId: Record<string, string[]>,
  renderStyle: string
): Array<{ questionText: string; selectedLabel: string; selectedValue: string }> {
  if (renderStyle === "instant-feedback-multi-choice") {
    return questions.map((q) => {
      const keptValues = answersByQuestionId[q.id] ?? [];
      const correctSignalValues = q.correctAnswers ?? [];
      const allItems = q.options;

      const keptLabels = allItems
        .filter((o) => keptValues.includes(o.value))
        .map((o) => o.label);
      const dismissedLabels = allItems
        .filter((o) => !keptValues.includes(o.value))
        .map((o) => o.label);
      const trueSignalLabels = allItems
        .filter((o) => correctSignalValues.includes(o.value))
        .map((o) => o.label);
      const signalsMissed = allItems
        .filter((o) => correctSignalValues.includes(o.value) && !keptValues.includes(o.value))
        .map((o) => o.label);
      const falsePositives = allItems
        .filter((o) => !correctSignalValues.includes(o.value) && keptValues.includes(o.value))
        .map((o) => o.label);

      const richText = [
        `True Signals: ${trueSignalLabels.join(" | ") || "none"}`,
        `User kept as Signal: ${keptLabels.join(" | ") || "none"}`,
        `User dismissed as Noise: ${dismissedLabels.join(" | ") || "none"}`,
        `Signals Missed: ${signalsMissed.join(" | ") || "none"}`,
        `Noise incorrectly kept: ${falsePositives.join(" | ") || "none"}`,
        `Score: ${trueSignalLabels.length - signalsMissed.length}/${trueSignalLabels.length} signals correct`,
      ].join("\n   ");

      return {
        questionText: q.questionText,
        selectedLabel: richText,
        selectedValue: keptValues.join(","),
      };
    });
  }

  if (renderStyle === "select-and-move" || renderStyle === "gamified-drag-drop") {
    return questions.map((q) => {
      const prioritizedValues = answersByQuestionId[q.id] ?? [];
      const prioritizedLabels = prioritizedValues
        .map((val) => q.options.find((o) => o.value === val)?.label ?? val)
        .filter(Boolean);

      const richText = [
        "Strategic Priority Order:",
        ...prioritizedLabels.map((label, i) => `  ${i + 1}. ${label}`),
      ].join("\n");

      return {
        questionText: q.questionText,
        selectedLabel: richText,
        selectedValue: prioritizedValues.join(","),
      };
    });
  }

  // Default: single-choice
  return questions.map((q) => {
    const vals = answersByQuestionId[q.id] ?? [];
    const selectedValue = vals[0] ?? "";
    const selectedOption = q.options.find((o) => o.value === selectedValue);
    return {
      questionText: q.questionText,
      selectedLabel: selectedOption?.label ?? selectedValue,
      selectedValue,
    };
  });
}

export default function AssessmentLaunchPage() {
  const params = useParams<{ assignmentId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AssessmentPhase>("welcome");
  const [currentIndex, setCurrentIndex] = useState(0);
  // All answers keyed by questionId — always string[] (1-item for single-choice, N-items for multi)
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [redirectingToReport, setRedirectingToReport] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [startedAtMs, setStartedAtMs] = useState<number>(0);

  useEffect(() => {
    const assignmentId = params?.assignmentId;
    if (!assignmentId) {
      setError("Invalid assessment assignment.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    void getAssessmentLaunchPayload(assignmentId)
      .then((payload) => {
        setLaunchState({
          assignment: payload.assignment,
          assessmentName: payload.assessment.name,
          shortDescription: payload.assessment.shortDescription ?? "",
          longDescription: payload.assessment.longDescription ?? "",
          assessmentImageUrl: payload.assessment.assessmentImageUrl ?? "",
          renderStyle: payload.assessment.renderStyle,
          assessmentContext: payload.assessment.assessmentContext,
          assessmentBenefit: payload.assessment.assessmentBenefit,
          analysisPrompt: payload.assessment.analysisPrompt,
          questions: payload.questions,
        });
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : "Failed to launch assessment.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [params]);

  const currentQuestion = useMemo(() => {
    if (!launchState) return null;
    return launchState.questions[currentIndex] ?? null;
  }, [currentIndex, launchState]);

  // answeredCount used by SingleChoiceQuiz internally — kept here only for the null guard below
  const routeTenantId = useMemo(() => {
    const segment = pathname.split("/")[1];
    return segment || "coaching-studio";
  }, [pathname]);

  const backDestination = useMemo(() => {
    const target = (searchParams.get("returnTo") || "").trim().toLowerCase();
    if (target === "assigned-activities") {
      return "assigned-activities";
    }
    return "my-activities";
  }, [searchParams]);

  const backHref = `/${launchState?.assignment.tenantId || routeTenantId}/${backDestination}`;

  function setAnswer(questionId: string, values: string[]): void {
    setAnswersByQuestionId((prev) => ({ ...prev, [questionId]: values }));
  }

  async function submitAssessment(
    pendingAnswer?: { questionId: string; values: string[] }
  ): Promise<void> {
    if (!launchState) {
      return;
    }

    const resolvedAnswersByQuestionId = pendingAnswer
      ? {
          ...answersByQuestionId,
          [pendingAnswer.questionId]: pendingAnswer.values,
        }
      : answersByQuestionId;

    // Single-choice and prioritize styles: validate all questions have a selection before allowing submit
    if (
      launchState.renderStyle === "single-choice" ||
      launchState.renderStyle === "select-and-move" ||
      launchState.renderStyle === "gamified-drag-drop"
    ) {
      const unanswered = launchState.questions.find(
        (question) => !(resolvedAnswersByQuestionId[question.id]?.length)
      );
      if (unanswered) {
        setError("Please answer all questions before submitting.");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    const answersForApi = buildAnswersForApi(
      launchState.questions,
      resolvedAnswersByQuestionId,
      launchState.renderStyle
    );

    try {
      const response = await fetch("/api/assessments/analyze-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentName: launchState.assessmentName,
          assessmentContext: launchState.assessmentContext,
          assessmentBenefit: launchState.assessmentBenefit,
          analysisPrompt: launchState.analysisPrompt,
          answers: answersForApi,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        aiProvider?: string;
        raw?: string;
        summary?: string;
        structured?: Record<string, unknown>;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to analyze assessment.");
      }

      // Build Firestore answer records — isCorrect works for both single and multi
      const answersSubmitted: AssessmentAnswerRecord[] = launchState.questions.map((question) => {
        const selectedValues = resolvedAnswersByQuestionId[question.id] ?? [];
        const correctAnswers = Array.isArray(question.correctAnswers) ? question.correctAnswers : [];

        const isCorrect =
          correctAnswers.length > 0 &&
          correctAnswers.every((v) => selectedValues.includes(v)) &&
          selectedValues.every((v) => correctAnswers.includes(v));

        return {
          questionId: question.id,
          questionText: question.questionText,
          selectedValues,
          correctAnswers,
          isCorrect,
        };
      });

      await saveAssessmentCompletion({
        assignment: launchState.assignment,
        assessment: {
          id: launchState.assignment.activityId,
          name: launchState.assessmentName,
        },
        questionsServed: launchState.questions,
        answersSubmitted,
        startedAtMs,
        aiProvider: data.aiProvider ?? "groq",
        analysisPromptUsed: launchState.analysisPrompt,
        aiResponseRaw: data.raw ?? "",
        reportSummary: data.summary ?? "Assessment completed.",
        reportStructuredData: data.structured ?? {},
      });

      setShowSuccessToast(true);
      setRedirectingToReport(true);
      window.setTimeout(() => {
        router.replace(
          `/${launchState.assignment.tenantId}/my-activities/assessment-report/${launchState.assignment.id}`
        );
      }, 500);
      return;
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to submit assessment.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0 }}>Assessment Launch</h1>
          <p style={{ marginTop: 10 }}>Preparing your assessment...</p>
        </section>
      </main>
    );
  }

  if (error && !launchState) {
    const fallbackPath = `/${routeTenantId || "coaching-studio"}/my-activities`;
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0 }}>Assessment Launch</h1>
          <p style={{ marginTop: 10, color: "#8b1f1f" }}>{error}</p>
          <Link href={fallbackPath}>Back to My activities</Link>
        </section>
      </main>
    );
  }

  if (!launchState || !currentQuestion) {
    return null;
  }

  const welcomeDetailsText =
    launchState.longDescription?.trim() ||
    launchState.shortDescription?.trim() ||
    "This assessment helps you build practical awareness of your leadership patterns in real-world situations.";

  const welcomeContextText =
    launchState.assessmentContext?.trim() ||
    launchState.shortDescription?.trim() ||
    "This assessment helps you evaluate how you think, decide, and respond in real-world leadership scenarios.";

  const welcomeBenefitText =
    launchState.assessmentBenefit?.trim() ||
    "You will receive practical insights into your patterns, blind spots, and focused actions you can apply immediately.";

  const keyTakeaways = welcomeBenefitText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[\-\*\u2022\d\.\)\s]+/, "").trim())
    .filter(Boolean);

  if (redirectingToReport) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0 }}>Assessment Completed</h1>
          <p style={{ marginTop: 10 }}>Opening your report...</p>
        </section>

        {showSuccessToast ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed",
              right: 20,
              bottom: 20,
              background: "#1c4f73",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(28,79,115,0.22)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.2,
              zIndex: 60,
            }}
          >
            Assessment submitted. Opening report...
          </div>
        ) : null}
      </main>
    );
  }

  // ── Unsupported render style ─────────────────────────────────────────────
  const QuizRunner = getQuizRunner(launchState.renderStyle);
  if (!QuizRunner) {
    return (
      <main style={{ minHeight: "100vh", padding: 24, background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0 }}>{launchState.assessmentName}</h1>
          <p style={{ marginTop: 10 }}>
            Render style <strong>{launchState.renderStyle}</strong> is not yet enabled.
          </p>
          <Link href={`/${launchState.assignment.tenantId}/my-activities`}>Back to My activities</Link>
        </section>
      </main>
    );
  }

  if (phase === "welcome") {
    return (
      <main style={{ minHeight: "100vh", padding: "32px 16px", background: "#f4f9ff", color: "#19334d" }}>
        <section
          style={{
            maxWidth: 760,
            margin: "0 auto",
            background: "#fff",
            border: "1px solid #d7e8f8",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 2px 16px rgba(28,79,115,0.07)",
          }}
        >
          {launchState.assessmentImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={launchState.assessmentImageUrl}
              alt={launchState.assessmentName}
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{ height: 8, background: "linear-gradient(90deg, #1c4f73 0%, #3a8fc7 100%)" }} />
          )}

          <div style={{ padding: "28px 32px 32px" }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#19334d", lineHeight: 1.25 }}>
              {launchState.assessmentName}
            </h1>

            {launchState.shortDescription ? (
              <p style={{ marginTop: 10, fontSize: 16, color: "#325370", lineHeight: 1.6 }}>
                {launchState.shortDescription}
              </p>
            ) : null}

            <hr style={{ border: "none", borderTop: "1px solid #e4eef7", margin: "24px 0" }} />

            <section style={{ marginBottom: 20, padding: "14px 16px", background: "#f8fbff", border: "1px solid #e4eef7", borderRadius: 10 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 600, color: "#1c4f73" }}>
                Details
              </h2>
              <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                {welcomeDetailsText}
              </p>
            </section>

            <section style={{ marginBottom: 20, padding: "14px 16px", background: "#f8fbff", border: "1px solid #e4eef7", borderRadius: 10 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 600, color: "#1c4f73" }}>
                Assessment Context
              </h2>
              <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                {welcomeContextText}
              </p>
            </section>

            <section style={{ marginBottom: 20, padding: "14px 16px", background: "#f8fbff", border: "1px solid #e4eef7", borderRadius: 10 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 600, color: "#1c4f73" }}>
                Key Takeaways
              </h2>
              {keyTakeaways.length > 1 ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: "#325370", lineHeight: 1.65 }}>
                  {keyTakeaways.map((item) => (
                    <li key={item} style={{ marginBottom: 6 }}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                  {welcomeBenefitText}
                </p>
              )}
            </section>

            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                margin: "24px 0",
                padding: "14px 18px",
                background: "#f0f7fd",
                borderRadius: 10,
                fontSize: 14,
                color: "#325370",
              }}
            >
              <span>
                <strong>{launchState.questions.length}</strong> questions
              </span>
              <span>
                Estimated time:{" "}
                <strong>~{Math.max(3, Math.ceil(launchState.questions.length * 0.75))} min</strong>
              </span>
              <span>Multiple choice</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="button"
                onClick={() => {
                  setStartedAtMs(Date.now());
                  setPhase("quiz");
                }}
                style={{
                  padding: "12px 28px",
                  borderRadius: 10,
                  border: "none",
                  background: "#1c4f73",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                Start Now
              </button>
              <Link href={backHref} style={{ color: "#325370", fontSize: 14 }}>
                Go back
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Quiz phase — delegate entirely to the runner ─────────────────────────
  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px", background: "#f4f9ff", color: "#19334d" }}>
      <QuizRunner
        assessmentName={launchState.assessmentName}
        tenantId={launchState.assignment.tenantId}
        questions={launchState.questions}
        currentIndex={currentIndex}
        answersByQuestionId={answersByQuestionId}
        onAnswer={setAnswer}
        onNext={() =>
          setCurrentIndex((prev) => Math.min(launchState.questions.length - 1, prev + 1))
        }
        onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
        onSubmit={(pendingAnswer) => void submitAssessment(pendingAnswer)}
        submitting={submitting}
        error={error}
      />
    </main>
  );
}
