"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { QuizRunnerProps } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBandLabel(value: number): string {
  if (value <= 33) return "Leaning left anchor";
  if (value >= 67) return "Leaning right anchor";
  return "Balanced midpoint";
}

/**
 * SliderScaleQuiz
 *
 * Render style: "slider-scale"
 *
 * Uses existing schema where options[0] and options[1] represent the
 * low/high anchors. Stored answer is a single numeric string from 0 to 100.
 */
export default function SliderScaleQuiz({
  assessmentName,
  tenantId,
  questions,
  currentIndex,
  answersByQuestionId,
  onAnswer,
  onNext,
  onPrev,
  onSubmit,
  submitting,
  error,
}: QuizRunnerProps) {
  const currentQuestion = questions[currentIndex] ?? null;
  if (!currentQuestion) return null;

  const isLastQuestion = currentIndex === questions.length - 1;
  const storedValue = answersByQuestionId[currentQuestion.id]?.[0] ?? "";
  const numericValue = storedValue ? clamp(Number(storedValue), 0, 100) : 50;
  const hasAnswered = Boolean(storedValue);

  const leftAnchor = currentQuestion.options[0]?.label ?? "Low";
  const rightAnchor = currentQuestion.options[1]?.label ?? "High";

  const answeredCount = useMemo(
    () => Object.values(answersByQuestionId).filter((v) => v.length > 0).length,
    [answersByQuestionId]
  );

  function persistCurrentValue(value: number): string {
    const nextValue = String(clamp(Math.round(value), 0, 100));
    onAnswer(currentQuestion.id, [nextValue]);
    return nextValue;
  }

  function handleNext() {
    if (!hasAnswered) {
      persistCurrentValue(numericValue);
    }
    onNext();
  }

  function handleSubmit() {
    const finalValue = hasAnswered ? String(numericValue) : persistCurrentValue(numericValue);
    onSubmit({ questionId: currentQuestion.id, values: [finalValue] });
  }

  return (
    <section
      style={{
        maxWidth: 860,
        margin: "0 auto",
        background: "#fff",
        border: "1px solid #d7e8f8",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22, color: "#19334d" }}>{assessmentName}</h1>
      <p style={{ marginTop: 8, marginBottom: 4, color: "#325370" }}>
        Question {currentIndex + 1} of {questions.length}
      </p>
      <p style={{ marginTop: 0, fontSize: 13, color: "#4a7598" }}>
        Answered {answeredCount} / {questions.length}
      </p>

      <article style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 14, color: "#19334d", lineHeight: 1.4 }}>
          {currentQuestion.questionText}
        </h2>

        <div
          style={{
            border: "1px solid #d7e8f8",
            borderRadius: 10,
            padding: "16px 16px 14px",
            background: "#f9fcff",
          }}
        >
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={numericValue}
            onChange={(event) => onAnswer(currentQuestion.id, [String(event.target.value)])}
            style={{ width: "100%" }}
            aria-label={currentQuestion.questionText}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 12 }}>
            <span style={{ fontSize: 13, color: "#325370", maxWidth: "45%" }}>{leftAnchor}</span>
            <span style={{ fontSize: 13, color: "#325370", maxWidth: "45%", textAlign: "right" }}>{rightAnchor}</span>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderTop: "1px solid #e5eef7",
              paddingTop: 10,
            }}
          >
            <span style={{ fontSize: 13, color: "#4a7598" }}>{getBandLabel(numericValue)}</span>
            <strong style={{ color: "#1c4f73" }}>{numericValue}/100</strong>
          </div>
        </div>
      </article>

      {error ? <p style={{ color: "#8b1f1f", marginTop: 12, fontSize: 14 }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={currentIndex === 0 || submitting}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #9dc3dd",
            background: "#fff",
            cursor: currentIndex === 0 || submitting ? "not-allowed" : "pointer",
            color: "#325370",
          }}
        >
          ← Previous
        </button>

        {!isLastQuestion ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #9dc3dd",
              background: "#e8f3fc",
              cursor: submitting ? "not-allowed" : "pointer",
              color: "#1c4f73",
            }}
          >
            Next Question →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #1c4f73",
              background: submitting ? "#8db8d8" : "#1c4f73",
              color: "#fff",
              cursor: submitting ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        )}

        <Link
          href={`/${tenantId}/my-activities`}
          style={{ marginLeft: "auto", color: "#6a8fa8", fontSize: 13, textDecoration: "none" }}
        >
          Exit
        </Link>
      </div>
    </section>
  );
}
