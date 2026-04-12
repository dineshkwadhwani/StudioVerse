import { NextRequest, NextResponse } from "next/server";
import { requestGroqChatCompletion } from "@/lib/ai/groq";

const GROQ_MODEL = "llama-3.3-70b-versatile";

type SubmittedAnswer = {
  questionText: string;
  selectedLabel: string;
  selectedValue: string;
};

type AnalyzeAttemptRequestBody = {
  assessmentName: string;
  assessmentContext: string;
  assessmentBenefit: string;
  analysisPrompt: string;
  answers: SubmittedAnswer[];
};

type StructuredReport = {
  summary: string;
  strengths: string[];
  blindSpots: string[];
  recommendations: string[];
  nextActions: string[];
};

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function normalizeReport(data: unknown): StructuredReport {
  if (!data || typeof data !== "object") {
    return {
      summary: "Assessment completed successfully.",
      strengths: [],
      blindSpots: [],
      recommendations: [],
      nextActions: [],
    };
  }

  const row = data as Record<string, unknown>;
  const toArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  };

  const summary = typeof row.summary === "string" ? row.summary.trim() : "Assessment completed successfully.";

  return {
    summary,
    strengths: toArray(row.strengths),
    blindSpots: toArray(row.blindSpots),
    recommendations: toArray(row.recommendations),
    nextActions: toArray(row.nextActions),
  };
}

export async function POST(request: NextRequest) {
  let body: AnalyzeAttemptRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.assessmentName?.trim()) {
    return NextResponse.json({ error: "assessmentName is required." }, { status: 400 });
  }

  if (!body.analysisPrompt?.trim()) {
    return NextResponse.json({ error: "analysisPrompt is required." }, { status: 400 });
  }

  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "answers are required." }, { status: 400 });
  }

  const systemPrompt = `You are an expert assessment analyst.
Always respond in valid JSON with this exact schema:
{
  "summary": "string",
  "strengths": ["string"],
  "blindSpots": ["string"],
  "recommendations": ["string"],
  "nextActions": ["string"]
}
Do not return markdown or additional commentary.`;

  const answersText = body.answers
    .map(
      (answer, index) =>
        `${index + 1}. Question: ${answer.questionText}\n   Selected: ${answer.selectedLabel} (${answer.selectedValue})`
    )
    .join("\n");

  const userPrompt = `Assessment Name: ${body.assessmentName}
Assessment Context: ${body.assessmentContext || "Not provided"}
Participant Benefit: ${body.assessmentBenefit || "Not provided"}

Analysis Instructions:
${body.analysisPrompt}

Participant Answers:
${answersText}`;

  let rawResponse = "";
  try {
    const completion = await requestGroqChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        model: GROQ_MODEL,
        temperature: 0.3,
      }
    );

    rawResponse = completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Groq request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const jsonPayload = extractJsonPayload(rawResponse);
    const parsed = JSON.parse(jsonPayload);
    const normalized = normalizeReport(parsed);

    return NextResponse.json({
      aiProvider: "groq",
      model: GROQ_MODEL,
      raw: rawResponse,
      structured: normalized,
      summary: normalized.summary,
    });
  } catch {
    return NextResponse.json({
      aiProvider: "groq",
      model: GROQ_MODEL,
      raw: rawResponse,
      structured: normalizeReport(null),
      summary: rawResponse.trim() || "Assessment completed successfully.",
    });
  }
}
