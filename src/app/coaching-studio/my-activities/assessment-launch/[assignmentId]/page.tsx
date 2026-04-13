"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname } from "next/navigation";
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

type AnalysisResponse = {
  aiProvider: string;
  raw: string;
  summary: string;
  structured: Record<string, unknown>;
};

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
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AssessmentPhase>("welcome");
  const [currentIndex, setCurrentIndex] = useState(0);
  // All answers keyed by questionId — always string[] (1-item for single-choice, N-items for multi)
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
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

  function setAnswer(questionId: string, values: string[]): void {
    setAnswersByQuestionId((prev) => ({ ...prev, [questionId]: values }));
  }

  async function submitAssessment(): Promise<void> {
    if (!launchState) {
      return;
    }

    // Single-choice: validate all questions have a selection before allowing submit
    if (launchState.renderStyle === "single-choice") {
      const unanswered = launchState.questions.find(
        (question) => !(answersByQuestionId[question.id]?.length)
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
      answersByQuestionId,
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
        const selectedValues = answersByQuestionId[question.id] ?? [];
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

      setCompleted(true);
      setResult({
        aiProvider: data.aiProvider ?? "groq",
        raw: data.raw ?? "",
        summary: data.summary ?? "Assessment completed.",
        structured: data.structured ?? {},
      });
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

            {launchState.assessmentContext ? (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 600, color: "#1c4f73" }}>
                  What this assessment is about
                </h2>
                <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                  {launchState.assessmentContext}
                </p>
              </div>
            ) : null}

            {launchState.assessmentBenefit ? (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 17, fontWeight: 600, color: "#1c4f73" }}>
                  What you will gain
                </h2>
                <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                  {launchState.assessmentBenefit}
                </p>
              </div>
            ) : null}

            {launchState.longDescription ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 15, color: "#325370", lineHeight: 1.65 }}>
                  {launchState.longDescription}
                </p>
              </div>
            ) : null}

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
              <Link href={`${launchState.assignment.tenantId || routeTenantId}/my-activities`} style={{ color: "#325370", fontSize: 14 }}>
                Go back
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Completion screen ────────────────────────────────────────────────────
  if (completed && result) {
    const strengths = toList(result.structured.strengths);
    const blindSpots = toList(result.structured.blindSpots);
    const recommendations = toList(result.structured.recommendations);
    const nextActions = toList(result.structured.nextActions);

    return (
      <main style={{ minHeight: "100vh", padding: 24, background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 900, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 20 }}>
          <h1 style={{ margin: 0 }}>Assessment Completed</h1>
          <p style={{ marginTop: 10 }}>{result.summary}</p>

          {strengths.length > 0 ? (
            <section style={{ marginTop: 14 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Strengths</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {strengths.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          {blindSpots.length > 0 ? (
            <section style={{ marginTop: 14 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Blind Spots</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {blindSpots.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          {recommendations.length > 0 ? (
            <section style={{ marginTop: 14 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Recommendations</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {recommendations.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          {nextActions.length > 0 ? (
            <section style={{ marginTop: 14 }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Next Actions</h2>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {nextActions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Link href={`/${launchState.assignment.tenantId}/my-activities`}>
              Back to My activities
            </Link>
            <Link href={`/${launchState.assignment.tenantId}/my-activities/assessment-report/${launchState.assignment.id}`}>
              Open Report
            </Link>
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
        onSubmit={() => void submitAssessment()}
        submitting={submitting}
        error={error}
      />
    </main>
  );
}
