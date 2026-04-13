"use client";

import Link from "next/link";
import { useState } from "react";
import type { QuizRunnerProps } from "./types";

/**
 * InstantFeedbackMultiChoiceQuiz
 *
 * Render style: "instant-feedback-multi-choice"
 *
 * UX: Presents each question as a scenario with N labelled items rendered as
 * interactive chips. The participant taps items they believe are NOISE to
 * dismiss them. Items left active are treated as their identified SIGNALS.
 * Chips toggle on re-tap (change of mind). After reviewing each scenario the
 * participant clicks "Next Scenario" to confirm and advance, or "Submit" on
 * the last scenario.
 *
 * This runner manages its own internal scenarioIndex; the page-level
 * currentIndex / onNext / onPrev props are not used.
 */
export default function InstantFeedbackMultiChoiceQuiz({
  assessmentName,
  tenantId,
  questions,
  onAnswer,
  onSubmit,
  submitting,
  error,
}: QuizRunnerProps) {
  // Internal scenario navigation — managed independently of page-level currentIndex
  const [scenarioIndex, setScenarioIndex] = useState(0);
  // Which item values the participant has dismissed as noise, keyed by questionId
  const [dismissedByQuestion, setDismissedByQuestion] = useState<Record<string, string[]>>({});

  const currentQuestion = questions[scenarioIndex] ?? null;
  if (!currentQuestion) return null;

  const isLastScenario = scenarioIndex === questions.length - 1;
  const dismissed = dismissedByQuestion[currentQuestion.id] ?? [];
  const keptCount = currentQuestion.options.length - dismissed.length;
  const progressPct = Math.round((scenarioIndex / Math.max(questions.length, 1)) * 100);

  function toggleChip(questionId: string, value: string) {
    setDismissedByQuestion((prev) => {
      const current = prev[questionId] ?? [];
      const alreadyDismissed = current.includes(value);
      return {
        ...prev,
        [questionId]: alreadyDismissed
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function handleConfirm() {
    const currentDismissed = dismissedByQuestion[currentQuestion.id] ?? [];
    // keptValues = items the participant left active (their identified signals)
    const keptValues = currentQuestion.options
      .filter((o) => !currentDismissed.includes(o.value))
      .map((o) => o.value);

    onAnswer(currentQuestion.id, keptValues);

    if (isLastScenario) {
      onSubmit();
    } else {
      setScenarioIndex((prev) => prev + 1);
    }
  }

  return (
    <section style={{ maxWidth: 820, margin: "0 auto" }}>

      {/* ── Header bar ───────────────────────────────────────────── */}
      <div
        style={{
          background: "#1c4f73",
          borderRadius: "14px 14px 0 0",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "#8db8d8",
              textTransform: "uppercase",
              letterSpacing: 0.9,
              fontWeight: 600,
            }}
          >
            {assessmentName}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 15, color: "#fff", fontWeight: 600 }}>
            Scenario {scenarioIndex + 1} of {questions.length}
          </p>
        </div>
        <Link
          href={`/${tenantId}/my-activities`}
          style={{ fontSize: 13, color: "#8db8d8", textDecoration: "none" }}
        >
          Exit ✕
        </Link>
      </div>

      {/* ── Thin progress bar ────────────────────────────────────── */}
      <div style={{ height: 4, background: "#d7e8f8" }}>
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "#3a8fc7",
            transition: "width 0.35s ease",
          }}
        />
      </div>

      {/* ── Main card ────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #d7e8f8",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          padding: "24px 28px 28px",
        }}
      >
        {/* Scenario context block */}
        <div
          style={{
            background: "#f0f7fd",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 22,
            borderLeft: "4px solid #3a8fc7",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.9,
              color: "#3a8fc7",
              fontWeight: 700,
            }}
          >
            Scenario
          </p>
          <p style={{ margin: 0, fontSize: 15, color: "#19334d", lineHeight: 1.7 }}>
            {currentQuestion.questionText}
          </p>
        </div>

        {/* Instruction */}
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#4a7598", fontStyle: "italic" }}>
          Tap the items you believe are <strong>noise</strong> to dismiss them.
          Items you leave active represent your identified signals. Tap again to undo.
        </p>

        {/* ── Chip grid ──────────────────────────────────────────── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {currentQuestion.options.map((option) => {
            const isDismissed = dismissed.includes(option.value);
            return (
              <button
                key={`${currentQuestion.id}-${option.value}`}
                type="button"
                onClick={() => toggleChip(currentQuestion.id, option.value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 24,
                  border: `2px solid ${isDismissed ? "#c4d4de" : "#1c4f73"}`,
                  background: isDismissed ? "#f0f4f7" : "#1c4f73",
                  color: isDismissed ? "#8ba4b4" : "#fff",
                  fontSize: 14,
                  fontWeight: isDismissed ? 400 : 500,
                  cursor: "pointer",
                  textDecoration: isDismissed ? "line-through" : "none",
                  opacity: isDismissed ? 0.6 : 1,
                  transition: "all 0.18s ease",
                  letterSpacing: 0.1,
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.8 }}>{isDismissed ? "✕" : "◆"}</span>
                {option.label}
              </button>
            );
          })}
        </div>

        {/* ── Running tally ──────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginBottom: 20,
            padding: "10px 14px",
            background: "#f8fbff",
            borderRadius: 8,
            fontSize: 13,
            color: "#325370",
            border: "1px solid #e4eef7",
          }}
        >
          <span>
            <strong style={{ color: "#1c4f73" }}>{keptCount}</strong>{" "}
            {keptCount === 1 ? "item" : "items"} kept as signal
          </span>
          <span>
            <strong style={{ color: dismissed.length > 0 ? "#8b3a1f" : "#6a8fa8" }}>
              {dismissed.length}
            </strong>{" "}
            dismissed as noise
          </span>
        </div>

        {error ? (
          <p style={{ color: "#8b1f1f", marginBottom: 14, fontSize: 14 }}>{error}</p>
        ) : null}

        {/* ── Confirm / advance button ────────────────────────────── */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            border: "none",
            background: submitting ? "#8db8d8" : "#1c4f73",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            letterSpacing: 0.3,
            transition: "background 0.15s ease",
          }}
        >
          {submitting
            ? "Analysing your responses..."
            : isLastScenario
            ? "Submit Assessment →"
            : `Confirm & Next Scenario (${scenarioIndex + 2} / ${questions.length}) →`}
        </button>
      </div>
    </section>
  );
}
