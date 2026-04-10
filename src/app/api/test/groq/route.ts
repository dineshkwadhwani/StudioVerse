import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY is not configured." }, { status: 500 });
  }

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

  const groqResponse = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a concise assistant for product and engineering validation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!groqResponse.ok) {
    const detail = await groqResponse.text();
    return NextResponse.json(
      { error: `Groq API error (${groqResponse.status})`, detail },
      { status: 502 }
    );
  }

  const data = await groqResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const response = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!response) {
    return NextResponse.json({ error: "Groq returned an empty response." }, { status: 502 });
  }

  return NextResponse.json({ response, usage: data.usage ?? null });
}
