import { NextRequest, NextResponse } from "next/server";
import { requestGroqChatCompletion } from "@/lib/ai/groq";
import type { GroqMessage } from "@/lib/ai/groq";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_HISTORY_TURNS = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode: "studio" | "professional";
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      context?: string; // RAG chunks for studio mode
      personaName: string;
      tenantName: string;
      professionalRole: string; // e.g. "Coach", "Trainer"
    };

    const { mode, messages, context, personaName, tenantName, professionalRole } = body;

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 503 });
    }

    // Cap history to last MAX_HISTORY_TURNS turns
    const trimmedMessages = messages.slice(-MAX_HISTORY_TURNS);

    let systemPrompt: string;
    if (mode === "studio") {
      systemPrompt = `You are ${personaName}, a warm and professional guide for ${tenantName}.
    Your tone should feel human, supportive, and clear.
    Answer questions using ONLY the provided context about the platform.
    If the answer is not in the context, say: "I do not want to misguide you. I do not have that detail in my current context, but I can help you reach the right team."
    Do not invent features, settings, or policies.
    Keep responses concise, structured, and easy to understand.
    Formatting rules:
    - Put each key point on a new line.
    - Use short numbered points when explaining steps.
    - Use **bold** only for important keywords or warnings.
    - Avoid one long paragraph.

CONTEXT:
${context ?? "No context provided."}`;
    } else {
      systemPrompt = `You are ${personaName}, an expert ${professionalRole} for ${tenantName}.
    Speak like a thoughtful, experienced coach: friendly, respectful, practical, and encouraging.
    Give actionable advice with a calm, human tone.
    Prefer short frameworks, reflection prompts, and next steps when useful.
    Keep responses concise (under 150 words).
    Formatting rules:
    - Put each key point on a new line.
    - Use short numbered points when suggesting steps.
    - Use **bold** only to emphasize critical points.
    - Avoid one long paragraph.
    Do not make medical, legal, or diagnostic claims.`;
    }

    const groqMessages: GroqMessage[] = [
      { role: "system", content: systemPrompt },
      ...trimmedMessages,
    ];

    const completion = await requestGroqChatCompletion(groqMessages, {
      model: GROQ_MODEL,
      maxTokens: 300,
      temperature: 0.5,
    });

    const reply = completion.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("Bot chat error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
