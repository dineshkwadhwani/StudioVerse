import { NextRequest, NextResponse } from "next/server";
import { requestGroqChatCompletion } from "@/lib/ai/groq";
import {
  DEFAULT_REPORT_STYLE,
  REPORT_STYLE_PROMPTS,
  REPORT_STYLE_SECTIONS,
} from "@/modules/assessments/report-styles";
import type { AssessmentReportStyle } from "@/types/assessment";

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
  reportStyle?: AssessmentReportStyle;
  analysisPrompt: string;
  answers: SubmittedAnswer[];
};

type StructuredReportSection = {
  key: string;
  title: string;
  items: string[];
};

type StructuredReport = {
  summary: string;
  reportStyle: AssessmentReportStyle;
  sections: StructuredReportSection[];
};

type SerializableCause =
  | string
  | number
  | boolean
  | null
  | {
      name?: string;
      message?: string;
      code?: string;
      errno?: string | number;
      syscall?: string;
      hostname?: string;
      address?: string;
      port?: number;
    };

function toSerializableCause(cause: unknown): SerializableCause | undefined {
  if (cause == null) {
    return undefined;
  }

  if (typeof cause === "string" || typeof cause === "number" || typeof cause === "boolean") {
    return cause;
  }

  if (cause instanceof Error) {
    const withNetworkFields = cause as Error & {
      code?: string;
      errno?: string | number;
      syscall?: string;
      hostname?: string;
      address?: string;
      port?: number;
    };

    return {
      name: withNetworkFields.name,
      message: withNetworkFields.message,
      code: withNetworkFields.code,
      errno: withNetworkFields.errno,
      syscall: withNetworkFields.syscall,
      hostname: withNetworkFields.hostname,
      address: withNetworkFields.address,
      port: withNetworkFields.port,
    };
  }

  if (typeof cause === "object") {
    const row = cause as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      errno?: unknown;
      syscall?: unknown;
      hostname?: unknown;
      address?: unknown;
      port?: unknown;
    };

    return {
      name: typeof row.name === "string" ? row.name : undefined,
      message: typeof row.message === "string" ? row.message : undefined,
      code: typeof row.code === "string" ? row.code : undefined,
      errno: typeof row.errno === "string" || typeof row.errno === "number" ? row.errno : undefined,
      syscall: typeof row.syscall === "string" ? row.syscall : undefined,
      hostname: typeof row.hostname === "string" ? row.hostname : undefined,
      address: typeof row.address === "string" ? row.address : undefined,
      port: typeof row.port === "number" ? row.port : undefined,
    };
  }

  return undefined;
}

function toErrorObject(error: unknown): {
  message: string;
  name: string;
  stack?: string;
  code?: string;
  errno?: string | number;
  syscall?: string;
  hostname?: string;
  address?: string;
  port?: number;
  cause?: SerializableCause;
} {
  if (error instanceof Error) {
    const withNetworkFields = error as Error & {
      code?: string;
      errno?: string | number;
      syscall?: string;
      hostname?: string;
      address?: string;
      port?: number;
      cause?: unknown;
    };

    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: withNetworkFields.code,
      errno: withNetworkFields.errno,
      syscall: withNetworkFields.syscall,
      hostname: withNetworkFields.hostname,
      address: withNetworkFields.address,
      port: withNetworkFields.port,
      cause: toSerializableCause(withNetworkFields.cause),
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
    name: "UnknownError",
  };
}

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

function normalizeItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function normalizeReport(data: unknown, reportStyle: AssessmentReportStyle): StructuredReport {
  const sectionDefinitions = REPORT_STYLE_SECTIONS[reportStyle] ?? REPORT_STYLE_SECTIONS[DEFAULT_REPORT_STYLE];

  if (!data || typeof data !== "object") {
    return {
      summary: "Assessment completed successfully.",
      reportStyle,
      sections: sectionDefinitions.map((section) => ({
        key: section.key,
        title: section.title,
        items: [],
      })),
    };
  }

  const row = data as Record<string, unknown>;
  const summary = typeof row.summary === "string" ? row.summary.trim() : "Assessment completed successfully.";

  const sectionsFromModel = Array.isArray(row.sections)
    ? row.sections
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const sectionRow = entry as Record<string, unknown>;
          const key = typeof sectionRow.key === "string" ? sectionRow.key.trim() : "";
          const title = typeof sectionRow.title === "string" ? sectionRow.title.trim() : "";
          const items = normalizeItems(sectionRow.items);
          if (!key || !items.length) {
            return null;
          }

          const definition = sectionDefinitions.find((section) => section.key === key);
          return {
            key,
            title: definition?.title ?? (title || key),
            items,
          };
        })
        .filter((entry): entry is StructuredReportSection => Boolean(entry))
    : [];

  if (sectionsFromModel.length > 0) {
    return {
      summary,
      reportStyle,
      sections: sectionDefinitions.map((definition) => {
        const matched = sectionsFromModel.find((section) => section.key === definition.key);
        return {
          key: definition.key,
          title: definition.title,
          items: matched?.items ?? [],
        };
      }),
    };
  }

  const legacyBuckets = [
    normalizeItems(row.strengths),
    normalizeItems(row.blindSpots),
    normalizeItems(row.recommendations),
    normalizeItems(row.nextActions),
  ];

  return {
    summary,
    reportStyle,
    sections: sectionDefinitions.map((section, index) => ({
      key: section.key,
      title: section.title,
      items: legacyBuckets[index] ?? [],
    })),
  };
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
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

  const reportStyle = body.reportStyle ?? DEFAULT_REPORT_STYLE;
  const reportStylePrompt = REPORT_STYLE_PROMPTS[reportStyle] ?? REPORT_STYLE_PROMPTS[DEFAULT_REPORT_STYLE];
  const sectionDefinitions = REPORT_STYLE_SECTIONS[reportStyle] ?? REPORT_STYLE_SECTIONS[DEFAULT_REPORT_STYLE];
  const systemPrompt = `You are an expert assessment analyst.
Always respond in valid JSON.
Return exactly these top-level keys:
{
  "summary": "string",
  "sections": [
    {
      "key": "string",
      "title": "string",
      "items": ["string"]
    }
  ]
}
Use only these section keys for this report style: ${sectionDefinitions.map((section) => section.key).join(", ")}.
Use the exact matching section titles: ${sectionDefinitions.map((section) => `${section.key} => ${section.title}`).join(", ")}.
Do not return markdown or additional commentary.`;
  const effectiveAnalysisPrompt = [
    body.analysisPrompt.trim(),
    "\n--- Report Style Guidance (System-Appended) ---\n",
    reportStylePrompt,
  ]
    .filter(Boolean)
    .join("\n");

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
${effectiveAnalysisPrompt}

Participant Answers:
${answersText}`;

  console.info("[analyze-attempt] Request received", {
    requestId,
    path: request.nextUrl.pathname,
    reportStyle,
    answerCount: body.answers.length,
    assessmentName: body.assessmentName,
    hasGroqApiKey: Boolean(process.env.GROQ_API_KEY),
  });

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
    const errorDetails = toErrorObject(error);
    console.error("[analyze-attempt] Groq request failed", {
      requestId,
      ...errorDetails,
      model: GROQ_MODEL,
      answerCount: body.answers.length,
      reportStyle,
    });

    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: errorDetails.message || "Groq request failed.",
        requestId,
        ...(isDev
          ? {
              debug: {
                name: errorDetails.name,
                stack: errorDetails.stack,
                code: errorDetails.code,
                errno: errorDetails.errno,
                syscall: errorDetails.syscall,
                hostname: errorDetails.hostname,
                address: errorDetails.address,
                port: errorDetails.port,
                cause: errorDetails.cause,
              },
            }
          : {}),
      },
      { status: 502 }
    );
  }

  try {
    const jsonPayload = extractJsonPayload(rawResponse);
    const parsed = JSON.parse(jsonPayload);
    const normalized = normalizeReport(parsed, reportStyle);

    return NextResponse.json({
      aiProvider: "groq",
      model: GROQ_MODEL,
      raw: rawResponse,
      structured: normalized,
      summary: normalized.summary,
      effectiveAnalysisPrompt,
      requestId,
    });
  } catch (error) {
    const errorDetails = toErrorObject(error);
    console.warn("[analyze-attempt] Failed to parse structured JSON from model response", {
      requestId,
      ...errorDetails,
      rawPreview: rawResponse.slice(0, 400),
      rawLength: rawResponse.length,
    });

    return NextResponse.json({
      aiProvider: "groq",
      model: GROQ_MODEL,
      raw: rawResponse,
      structured: normalizeReport(null, reportStyle),
      summary: rawResponse.trim() || "Assessment completed successfully.",
      effectiveAnalysisPrompt,
      requestId,
    });
  }
}
