import { NextRequest, NextResponse } from "next/server";
import { requestGroqChatCompletion } from "@/lib/ai/groq";

const GROQ_MODEL = "llama-3.3-70b-versatile";

export type GenerateQuestionsRequestBody = {
  assessmentName: string;
  assessmentContext: string;
  assessmentBenefit: string;
  renderStyle: string;
  questionGenerationPrompt: string;
  questionCount: number;
  existingCount?: number;
};

type NormalizedQuestion = {
  questionText: string;
  options: Array<{ label: string; value: string }>;
  correctAnswers: string[]; // Array of correct answer values
  scoringRule: string;
  imageDescription: string;
  tags: string[];
  weight: number;
};

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getCaseInsensitiveValue(source: Record<string, unknown>, key: string): unknown {
  const direct = source[key];
  if (typeof direct !== "undefined") return direct;

  const lowerKey = key.toLowerCase();
  const found = Object.keys(source).find((k) => k.toLowerCase() === lowerKey);
  return found ? source[found] : undefined;
}

function getFirstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = getCaseInsensitiveValue(source, key);
    if (typeof value !== "undefined") return value;
  }
  return undefined;
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function extractBalancedJsonBlocks(raw: string): string[] {
  const blocks: string[] = [];
  const stack: string[] = [];
  let startIndex = -1;
  let inString = false;
  let escaping = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === "\\") {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      if (stack.length === 0) {
        startIndex = i;
      }
      stack.push(ch === "{" ? "}" : "]");
      continue;
    }

    if (ch === "}" || ch === "]") {
      if (stack.length === 0) {
        continue;
      }

      const expectedClose = stack[stack.length - 1];
      if (ch !== expectedClose) {
        continue;
      }

      stack.pop();
      if (stack.length === 0 && startIndex >= 0) {
        blocks.push(raw.slice(startIndex, i + 1));
        startIndex = -1;
      }
    }
  }

  return blocks;
}

function parseJsonFromRaw(raw: string): { parsed: unknown; payload: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const candidateSet = new Set<string>();
  const candidates: string[] = [];

  function addCandidate(value: string) {
    const normalized = value.trim();
    if (!normalized || candidateSet.has(normalized)) {
      return;
    }
    candidateSet.add(normalized);
    candidates.push(normalized);
  }

  addCandidate(extractJsonPayload(trimmed));
  addCandidate(trimmed);

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  for (const match of trimmed.matchAll(fenceRegex)) {
    if (match[1]) {
      addCandidate(match[1]);
    }
  }

  for (const block of extractBalancedJsonBlocks(trimmed)) {
    addCandidate(block);
  }

  for (const payload of candidates) {
    try {
      return {
        parsed: JSON.parse(payload),
        payload,
      };
    } catch {
      // Try the next candidate; model output may contain non-JSON wrappers.
    }
  }

  return null;
}

async function repairJsonWithGroq(rawContent: string): Promise<{ parsed: unknown; payload: string } | null> {
  if (!rawContent.trim()) {
    return null;
  }

  try {
    const completion = await requestGroqChatCompletion(
      [
        {
          role: "system",
          content:
            "You are a strict JSON repair utility. Convert the user's content into valid JSON only. Return a JSON object with shape {\"questions\":[...]} where each question has keys questionText, options, correctAnswer (or correctAnswers), scoringRule, imageDescription, tags, weight. No markdown.",
        },
        {
          role: "user",
          content: `Repair this content into valid JSON:\n\n${rawContent}`,
        },
      ],
      {
        model: GROQ_MODEL,
        temperature: 0,
        responseFormat: { type: "json_object" },
      }
    );

    const repairedRaw = completion.choices[0]?.message?.content ?? "";
    return parseJsonFromRaw(repairedRaw);
  } catch {
    return null;
  }
}

function unwrapQuestionsContainer(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];

  const row = parsed as Record<string, unknown>;
  const candidates = [
    getFirstValue(row, ["questions", "items", "data", "questionBank", "question_bank"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizeOptions(input: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(input)) {
    if (input && typeof input === "object") {
      // Supports map/object style options: {"A":"Option 1","B":"Option 2"}
      return Object.entries(input as Record<string, unknown>)
        .map(([key, value]) => {
          const label = toStringValue(value).trim();
          if (!label) return null;
          return { label, value: key };
        })
        .filter((item): item is { label: string; value: string } => Boolean(item));
    }
    return [];
  }

  return input
    .map((item, index) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        const optionValue = String.fromCharCode(65 + index);
        return {
          label: trimmed,
          value: optionValue,
        };
      }

      if (item && typeof item === "object") {
        const maybe = item as Record<string, unknown>;
        const label =
          toStringValue(getFirstValue(maybe, ["label", "text", "option", "name"])).trim();
        const value =
          toStringValue(getFirstValue(maybe, ["value", "key", "id", "optionKey", "option_key", "style", "type"]))
            .trim() ||
          String.fromCharCode(65 + index);

        if (!label) return null;
        return { label, value };
      }

      return null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));
}

function normalizeQuestions(rawQuestions: unknown[]): NormalizedQuestion[] {
  return rawQuestions
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const row = item as Record<string, unknown>;
      // Support schemas that split context into "scenario" + "question" fields
      const scenarioText = toStringValue(getFirstValue(row, ["scenario", "context", "background"])).trim();
      const questionText =
        (() => {
          const q = toStringValue(
            getFirstValue(row, [
              "questionText",
              "question_text",
              "question",
              "prompt",
              "text",
              "statement",
              "question_title",
            ])
          ).trim();
          // If a separate scenario/context is present, prepend it
          return scenarioText && scenarioText !== q
            ? `${scenarioText}\n\n${q}`
            : q;
        })();

      const rawItemsField = getFirstValue(row, ["items"]);
      let options = normalizeOptions(
        getFirstValue(row, ["options", "choices", "answers", "answerOptions", "answer_options", "items"])
      );
      // Derive correctAnswers from isSignal flags when using the signal-noise schema
      let derivedCorrectAnswers: string[] | null = null;
      if (Array.isArray(rawItemsField) && rawItemsField.length > 0) {
        derivedCorrectAnswers = (rawItemsField as unknown[])
          .map((item, idx) => {
            if (!item || typeof item !== "object") return null;
            const it = item as Record<string, unknown>;
            return it.isSignal === true ? String.fromCharCode(65 + idx) : null;
          })
          .filter((v): v is string => v !== null);
        // Re-derive options from items to ensure consistent A/B/C value assignment
        options = (rawItemsField as unknown[])
          .map((item, idx) => {
            if (!item || typeof item !== "object") return null;
            const it = item as Record<string, unknown>;
            const label = toStringValue(getFirstValue(it, ["label", "text", "name"])).trim();
            if (!label) return null;
            return { label, value: String.fromCharCode(65 + idx) };
          })
          .filter((o): o is { label: string; value: string } => Boolean(o));
      }
      const correctAnswerRaw = getFirstValue(row, ["correctAnswers", "correctAnswer", "correct_option", "answer", "correct", "correct_answers"]);
      const correctAnswers = derivedCorrectAnswers ?? (
        Array.isArray(correctAnswerRaw)
          ? (correctAnswerRaw as unknown[])
              .map((v) => toStringValue(v).trim())
              .filter(Boolean)
          : toStringValue(correctAnswerRaw).trim()
          ? [toStringValue(correctAnswerRaw).trim()]
          : []
      );

      if (!questionText) return null;

      return {
        questionText,
        options,
        correctAnswers,
        scoringRule: toStringValue(getFirstValue(row, ["scoringRule", "scoring", "scoreRule", "score_rule"])).trim() || "correct=1, wrong=0",
        imageDescription: toStringValue(getFirstValue(row, ["imageDescription", "image_description", "imageCaption", "image_caption"])).trim(),
        tags: Array.isArray(getFirstValue(row, ["tags", "tagList", "tag_list"]))
          ? (getFirstValue(row, ["tags", "tagList", "tag_list"]) as unknown[])
              .map((tag) => toStringValue(tag).trim())
              .filter(Boolean)
          : [],
        weight:
          typeof getFirstValue(row, ["weight", "scoreWeight", "score_weight"]) === "number" &&
          Number.isFinite(getFirstValue(row, ["weight", "scoreWeight", "score_weight"]) as number)
            ? (getFirstValue(row, ["weight", "scoreWeight", "score_weight"]) as number)
            : 1,
      };
    })
    .filter((item): item is NormalizedQuestion => Boolean(item));
}

export async function POST(request: NextRequest) {
  const traceId = `assessment-gen-${Date.now()}`;
  console.info(`[${traceId}] Request received for assessment question generation.`);

  let body: GenerateQuestionsRequestBody;
  try {
    body = await request.json();
  } catch {
    console.error(`[${traceId}] Invalid JSON request body.`);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { assessmentName, assessmentContext, assessmentBenefit, renderStyle, questionGenerationPrompt, questionCount, existingCount = 0 } = body;

  if (!assessmentName || !renderStyle || !questionGenerationPrompt || !questionCount) {
    console.warn(`[${traceId}] Missing required request fields.`, {
      hasAssessmentName: Boolean(assessmentName),
      hasRenderStyle: Boolean(renderStyle),
      hasPrompt: Boolean(questionGenerationPrompt),
      questionCount,
    });
    return NextResponse.json({ error: "Missing required fields: assessmentName, renderStyle, questionGenerationPrompt, questionCount." }, { status: 400 });
  }

  if (questionCount < 1 || questionCount > 100) {
    console.warn(`[${traceId}] Invalid questionCount: ${questionCount}`);
    return NextResponse.json({ error: "questionCount must be between 1 and 100." }, { status: 400 });
  }

  console.info(`[${traceId}] Input validated.`, {
    assessmentName,
    renderStyle,
    questionCount,
    existingCount,
  });

  const systemPrompt = `You are an expert assessment designer for professional development and coaching programmes. 
You generate well-structured, contextually appropriate assessment questions.
Always respond with a valid JSON array only — no markdown, no explanation, no code fences.
Each question object must follow this exact schema:
{
  "questionText": "string",
  "options": [{ "label": "string", "value": "string" }],
  "correctAnswer": "string (must match one option value)",
  "scoringRule": "string (e.g. 'correct=1, wrong=0')",
  "imageDescription": "string (leave empty unless render style is image-based)",
  "tags": ["string"],
  "weight": 1
}
For single-choice and image-based questions: provide 4 options.
For instant-feedback-multi-choice: provide 4-6 options, mark multiple as correct by setting correctAnswer to a comma-separated list of values.
For select-and-move: provide 8-12 items as options, correctAnswer lists the ones that belong in the selected group.
For gamified-drag-drop: provide 6-8 pairs as options where value includes the matching pair.`;

  const userPrompt = `Assessment Name: ${assessmentName}
Assessment Context: ${assessmentContext || "General professional development"}
Participant Benefit: ${assessmentBenefit || "Gain self-awareness and actionable insights"}
Render Style: ${renderStyle}
Specific Instructions: ${questionGenerationPrompt}

Generate exactly ${questionCount} unique questions for this assessment. 
${existingCount > 0 ? `There are already ${existingCount} questions created — generate new ones that do not repeat those topics.` : ""}
Return only a JSON array of ${questionCount} question objects. No other text.`;

  let rawContent = "";
  try {
    const completion = await requestGroqChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        model: GROQ_MODEL,
        temperature: 0.6,
      }
    );

    rawContent = completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Groq error";
    console.error(`[${traceId}] Groq request failed.`, {
      message,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  console.info(`[${traceId}] Groq response received.`, {
    hasChoices: Boolean(rawContent),
    rawLength: rawContent.length,
    rawPreview: rawContent.slice(0, 400),
  });

  let questions: unknown[];
  let jsonPayload = "";
  try {
    let parsedResult = parseJsonFromRaw(rawContent);
    if (!parsedResult) {
      console.warn(`[${traceId}] Initial JSON parse failed. Attempting repair pass.`);
      parsedResult = await repairJsonWithGroq(rawContent);
    }

    if (!parsedResult) {
      throw new Error("Could not parse a valid JSON payload from AI response");
    }

    jsonPayload = parsedResult.payload;
    console.info(`[${traceId}] JSON payload extracted.`, {
      payloadLength: jsonPayload.length,
      payloadPreview: jsonPayload.slice(0, 400),
    });

    const parsed = parsedResult.parsed;
    console.info(`[${traceId}] Parsed JSON.`, {
      parsedType: Array.isArray(parsed) ? "array" : typeof parsed,
      parsedKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed as Record<string, unknown>).slice(0, 20)
        : [],
    });

    questions = unwrapQuestionsContainer(parsed);
    console.info(`[${traceId}] Questions container unwrapped.`, {
      questionsCount: Array.isArray(questions) ? questions.length : -1,
      firstQuestionKeys:
        Array.isArray(questions) && questions.length > 0 && questions[0] && typeof questions[0] === "object"
          ? Object.keys(questions[0] as Record<string, unknown>).slice(0, 20)
          : [],
    });

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("Response has no questions array");
    }
  } catch (parseError) {
    const parseMessage = parseError instanceof Error ? parseError.message : String(parseError);
    console.error(`[${traceId}] JSON parse/unwrap failed.`, {
      error: parseMessage,
      rawPreview: rawContent.slice(0, 800),
      extractedPreview: jsonPayload.slice(0, 800),
    });
    return NextResponse.json(
      { error: "AI returned non-JSON content. Try rephrasing the question generation prompt.", raw: rawContent },
      { status: 422 }
    );
  }

  const normalizedQuestions = normalizeQuestions(questions);
  console.info(`[${traceId}] Normalization complete.`, {
    inputCount: questions.length,
    normalizedCount: normalizedQuestions.length,
    firstNormalizedQuestion: normalizedQuestions[0] ?? null,
  });

  if (normalizedQuestions.length === 0) {
    const sampleQuestions = questions.slice(0, 3).map((item, index) => {
      if (!item || typeof item !== "object") {
        return { index, type: typeof item, value: item };
      }
      const row = item as Record<string, unknown>;
      return {
        index,
        keys: Object.keys(row),
        sample: row,
      };
    });

    console.error(`[${traceId}] No valid questions after normalization.`, {
      inputCount: questions.length,
      sampleQuestions,
    });

    return NextResponse.json(
      {
        error: "AI response was parsed, but no valid questions were found after normalization.",
        raw: rawContent,
      },
      { status: 422 }
    );
  }

  console.info(`[${traceId}] Returning normalized questions successfully.`, {
    retrievedCount: normalizedQuestions.length,
  });

  return NextResponse.json({ questions: normalizedQuestions, retrievedCount: normalizedQuestions.length });
}
