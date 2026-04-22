import { NextRequest, NextResponse } from "next/server";

type SendMailRequest = {
  toEmail?: string;
  toName?: string;
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  body?: string;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  let payload: SendMailRequest;
  try {
    payload = (await req.json()) as SendMailRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const toEmail = String(payload.toEmail ?? "").trim();
  const toName = String(payload.toName ?? "").trim();
  const fromEmail = String(payload.fromEmail ?? "").trim();
  const fromName = String(payload.fromName ?? "").trim();
  const subject = String(payload.subject ?? "").trim();
  const body = String(payload.body ?? "").trim();

  if (!toEmail || !fromEmail || !fromName || !subject || !body) {
    return NextResponse.json(
      { error: "Missing required fields: toEmail, fromEmail, fromName, subject, body." },
      { status: 400 }
    );
  }

  if (!isValidEmail(toEmail) || !isValidEmail(fromEmail)) {
    return NextResponse.json({ error: "Invalid sender or recipient email." }, { status: 400 });
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toName ? `${toName} <${toEmail}>` : toEmail],
      subject,
      text: body,
    }),
  });

  const data = (await resendResponse.json()) as {
    id?: string;
    error?: { name?: string; message?: string };
  };

  if (!resendResponse.ok) {
    return NextResponse.json(
      {
        error: data.error?.name ?? "Resend API error",
        detail: data.error?.message ?? `Status ${resendResponse.status}`,
      },
      { status: resendResponse.status }
    );
  }

  // Temporary debug log for mail send confirmation during testing.
  console.info("[MAIL_DEBUG] Message sent", {
    messageId: data.id ?? "unknown",
    toEmail,
    toName,
    fromEmail,
    fromName,
    subject,
  });

  return NextResponse.json({ ok: true, messageId: data.id });
}
