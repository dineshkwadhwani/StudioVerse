"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { QuizRunnerProps } from "./types";

export default function SingleChoiceQuiz({
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

  // Single-choice stores exactly one selected value in the array
  const selectedValue = answersByQuestionId[currentQuestion.id]?.[0] ?? "";
  const isLastQuestion = currentIndex === questions.length - 1;

  const answeredCount = useMemo(
    () => Object.values(answersByQuestionId).filter((v) => v.length > 0).length,
    [answersByQuestionId]
  );

  return (
    <section
      style={{
        maxWidth: 780,
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
        <h2 style={{ fontSize: 20, marginBottom: 12, color: "#19334d", lineHeight: 1.4 }}>
          {currentQuestion.questionText}
        </h2>

        <div style={{ display: "grid", gap: 10 }}>
          {currentQuestion.options.map((option) => {
            const isSelected = selectedValue === option.value;
            return (
              <label
                key={`${currentQuestion.id}-${option.value}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: `1px solid ${isSelected ? "#1c4f73" : "#d7e8f8"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  cursor: "pointer",
                  background: isSelected ? "#edf4fb" : "#fff",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  checked={isSelected}
                  onChange={() => onAnswer(currentQuestion.id, [option.value])}
                />
                <span style={{ fontSize: 15, color: "#19334d" }}>{option.label}</span>
              </label>
            );
          })}
        </div>
      </article>

      {error ? (
        <p style={{ color: "#8b1f1f", marginTop: 12, fontSize: 14 }}>{error}</p>
      ) : null}

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
            onClick={onNext}
            disabled={!selectedValue || submitting}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #9dc3dd",
              background: "#e8f3fc",
              cursor: !selectedValue || submitting ? "not-allowed" : "pointer",
              color: "#1c4f73",
            }}
          >
            Next Question →
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || !selectedValue}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "1px solid #1c4f73",
              background: submitting || !selectedValue ? "#8db8d8" : "#1c4f73",
              color: "#fff",
              cursor: submitting || !selectedValue ? "not-allowed" : "pointer",
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
