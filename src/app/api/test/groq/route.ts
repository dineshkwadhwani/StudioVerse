import { NextRequest, NextResponse } from "next/server";
import { requestGroqChatCompletion } from "@/lib/ai/groq";

const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function POST(request: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (prompt.length > 8000) {
    return NextResponse.json({ error: "Prompt is too long (max 8000 characters)." }, { status: 400 });
  }

  try {
    const completion = await requestGroqChatCompletion(
      [
        {
          role: "system",
          content: "You are a concise assistant for product and engineering validation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        model: GROQ_MODEL,
        temperature: 0.2,
      }
    );

    const response = completion.choices[0]?.message?.content?.trim() ?? "";

    if (!response) {
      return NextResponse.json({ error: "Groq returned an empty response." }, { status: 502 });
    }

    return NextResponse.json({ response, usage: completion.usage ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Groq request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
