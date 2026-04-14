"use client";

import { useEffect, useState } from "react";
import type { QuizRunnerProps } from "./types";

/**
 * GamifiedDragDropQuiz
 *
 * Render style: "gamified-drag-drop"
 *
 * UX: Presents each question as a strategic scenario with a problem description
 * and a set of actions/options. The participant prioritizes these actions by
 * dragging them up/down to establish their strategic thinking. The system records
 * the final prioritization order and sends it to AI for strategic analysis.
 *
 * This runner manages its own internal scenarioIndex; the page-level
 * currentIndex / onNext / onPrev props are not used.
 */
export default function GamifiedDragDropQuiz({
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
  // Ordered priorities for each scenario: questionId -> [action values in priority order]
  const [prioritiesByQuestion, setPrioritiesByQuestion] = useState<Record<string, string[]>>({});
  // Track which item is being dragged
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const currentQuestion = questions[scenarioIndex] ?? null;
  if (!currentQuestion) return null;

  const isLastScenario = scenarioIndex === questions.length - 1;
  const progressPct = Math.round((scenarioIndex / Math.max(questions.length, 1)) * 100);

  // Initialize priorities for current question if not set
  useEffect(() => {
    if (!prioritiesByQuestion[currentQuestion.id]) {
      // Start with original order
      setPrioritiesByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: currentQuestion.options.map((o) => o.value),
      }));
    }
  }, [currentQuestion, prioritiesByQuestion]);

  const currentPriorities = prioritiesByQuestion[currentQuestion.id] ?? currentQuestion.options.map((o) => o.value);

  // Drag handlers
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, index: number) {
    setDraggedItem(String(index));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, dropIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    if (draggedItem === null) return;

    const dragIndex = parseInt(draggedItem, 10);
    if (dragIndex === dropIndex) {
      setDraggedItem(null);
      return;
    }

    const newPriorities = [...currentPriorities];
    const [draggedValue] = newPriorities.splice(dragIndex, 1);
    newPriorities.splice(dropIndex, 0, draggedValue);

    setPrioritiesByQuestion((prev) => ({
      ...prev,
      [currentQuestion.id]: newPriorities,
    }));

    setDraggedItem(null);
  }

  function handleDragEnd() {
    setDraggedItem(null);
    setDragOverIndex(null);
  }

  function handleConfirm() {
    const finalPriorities = prioritiesByQuestion[currentQuestion.id] ?? currentQuestion.options.map((o) => o.value);
    // Send prioritized order to page state
    onAnswer(currentQuestion.id, finalPriorities);

    if (isLastScenario) {
      onSubmit({ questionId: currentQuestion.id, values: finalPriorities });
    } else {
      setScenarioIndex((prev) => prev + 1);
    }
  }

  // Map values back to labels for display
  const getOptionLabel = (value: string): string => {
    return currentQuestion.options.find((o) => o.value === value)?.label ?? value;
  };

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
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#8db8d8",
          }}
        >
          {progressPct}%
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────── */}
      <div
        style={{
          height: 3,
          background: "#d7e8f8",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #1c4f73 0%, #3a8fc7 100%)",
            width: `${progressPct}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* ── Question text (scenario/problem) ──────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderLeft: "1px solid #d7e8f8",
          borderRight: "1px solid #d7e8f8",
          padding: "24px 24px 12px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "#325370",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Scenario
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.6,
            color: "#1c3a4d",
            fontWeight: 500,
          }}
        >
          {currentQuestion.questionText}
        </p>
      </div>

      {/* ── Instruction ──────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderLeft: "1px solid #d7e8f8",
          borderRight: "1px solid #d7e8f8",
          padding: "12px 24px",
          borderTop: "1px solid #ede8f0",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "#5f7fa8",
            fontStyle: "italic",
          }}
        >
          Drag and drop actions below to prioritize them. Most urgent/important at the top.
        </p>
      </div>

      {/* ── Draggable priorities list ──────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderLeft: "1px solid #d7e8f8",
          borderRight: "1px solid #d7e8f8",
          padding: "20px 24px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {currentPriorities.map((value, index) => {
            const label = getOptionLabel(value);
            const isDragging = draggedItem === String(index);
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={`${currentQuestion.id}-${index}-${value}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  padding: "16px 16px",
                  background: isDragging ? "#f0f4f9" : isDragOver ? "#e8f1ff" : "#f9fbfd",
                  border: `2px solid ${isDragOver ? "#3a8fc7" : "#d7e8f8"}`,
                  borderRadius: 10,
                  cursor: "grab",
                  transition: "all 0.2s ease",
                  opacity: isDragging ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  userSelect: "none",
                }}
              >
                {/* Priority badge */}
                <div
                  style={{
                    minWidth: 32,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #1c4f73 0%, #3a8fc7 100%)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </div>

                {/* Action text */}
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#1c3a4d",
                      fontWeight: 500,
                      lineHeight: 1.5,
                    }}
                  >
                    {label}
                  </p>
                </div>

                {/* Drag handle icon */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: isDragging ? 0.4 : 0.6,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 20,
                        height: 2,
                        background: "#3a8fc7",
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Help text ────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fff",
          borderLeft: "1px solid #d7e8f8",
          borderRight: "1px solid #d7e8f8",
          padding: "12px 24px",
          borderTop: "1px solid #ede8f0",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "#7f95ad",
            textAlign: "center",
          }}
        >
          💡 Tip: Think strategically about which actions address the root cause vs. symptoms
        </p>
      </div>

      {/* ── Error message ────────────────────────────────────────── */}
      {error ? (
        <div
          style={{
            background: "#fff",
            borderLeft: "1px solid #d7e8f8",
            borderRight: "1px solid #d7e8f8",
            padding: "12px 24px",
            borderTop: "1px solid #ede8f0",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#8b1f1f",
            }}
          >
            {error}
          </p>
        </div>
      ) : null}

      {/* ── Button bar ───────────────────────────────────────────── */}
      <div
        style={{
          background: "#f9fbfd",
          border: "1px solid #d7e8f8",
          borderRadius: "0 0 14px 14px",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <button
          onClick={handleConfirm}
          disabled={submitting}
          style={{
            padding: "10px 24px",
            background: submitting
              ? "#c5d9e8"
              : "linear-gradient(135deg, #1c4f73 0%, #3a8fc7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            opacity: submitting ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!submitting) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(28,79,115,0.2)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {isLastScenario ? (submitting ? "Submitting..." : "Submit Assessment") : "Next Scenario"}
        </button>
      </div>
    </section>
  );
}
