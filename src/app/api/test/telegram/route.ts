import {NextRequest, NextResponse} from "next/server";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !defaultChatId) {
    return NextResponse.json(
      {error: "TELEGRAM_TOKEN or TELEGRAM_CHAT_ID is not configured."},
      {status: 500}
    );
  }

  let body: {message?: string};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({error: "Invalid request body."}, {status: 400});
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({error: "Message is required."}, {status: 400});
  }

  if (message.length > 4096) {
    return NextResponse.json({error: "Message is too long (max 4096 characters)."}, {status: 400});
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  const telegramResponse = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      chat_id: defaultChatId,
      text: message,
      parse_mode: "HTML",
    }),
  });

  const data = (await telegramResponse.json()) as {
    ok: boolean;
    result?: {message_id: number};
    description?: string;
  };

  if (!telegramResponse.ok || !data.ok) {
    return NextResponse.json(
      {error: `Telegram API error (${telegramResponse.status})`, detail: data.description ?? "Unknown error"},
      {status: 502}
    );
  }

  return NextResponse.json({
    ok: true,
    messageId: data.result?.message_id ?? 0,
  });
}
