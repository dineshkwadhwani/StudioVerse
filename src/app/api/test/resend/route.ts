import {NextRequest, NextResponse} from "next/server";

const SENDER_EMAIL = "contact@coachingstudio.in";

type DebugStep = {step: string; status: "ok" | "error" | "info"; detail?: string};

export async function POST(req: NextRequest) {
  const debug: DebugStep[] = [];

  // Step 1: Check API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    debug.push({step: "Read RESEND_API_KEY from env", status: "error", detail: "Variable is not set"});
    return NextResponse.json({error: "RESEND_API_KEY is not configured.", debug}, {status: 500});
  }
  debug.push({step: "Read RESEND_API_KEY from env", status: "ok", detail: `Key starts with: ${apiKey.slice(0, 8)}…`});

  // Step 2: Parse request body
  let body: {to?: string; fromName?: string; subject?: string; emailBody?: string};
  try {
    body = (await req.json()) as typeof body;
    debug.push({step: "Parse request body", status: "ok"});
  } catch {
    debug.push({step: "Parse request body", status: "error", detail: "Invalid JSON"});
    return NextResponse.json({error: "Invalid JSON body.", debug}, {status: 400});
  }

  const {to, fromName, subject, emailBody} = body;

  // Step 3: Validate fields
  const missing = (["to", "fromName", "subject", "emailBody"] as const).filter((f) => !body[f]);
  if (missing.length > 0) {
    debug.push({step: "Validate fields", status: "error", detail: `Missing: ${missing.join(", ")}`});
    return NextResponse.json({error: "Missing required fields.", debug}, {status: 400});
  }
  debug.push({step: "Validate fields", status: "ok", detail: `to=${to}, fromName=${fromName}, subject=${subject}`});

  // Step 4: Build payload
  const from = `${fromName} <${SENDER_EMAIL}>`;
  const payload = {from, to: [to!], subject: subject!, text: emailBody!};
  debug.push({step: "Build Resend payload", status: "ok", detail: JSON.stringify(payload)});

  // Step 5: Call Resend API
  let resendResponse: Response;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    debug.push({step: "HTTP call to Resend API", status: "ok", detail: `HTTP ${resendResponse.status} ${resendResponse.statusText}`});
  } catch (err) {
    debug.push({step: "HTTP call to Resend API", status: "error", detail: err instanceof Error ? err.message : String(err)});
    return NextResponse.json({error: "Network error calling Resend.", debug}, {status: 502});
  }

  // Step 6: Parse Resend response
  const data = (await resendResponse.json()) as {id?: string; error?: {message?: string; name?: string}};
  debug.push({step: "Parse Resend response body", status: "ok", detail: JSON.stringify(data)});

  // Step 7: Evaluate result
  if (!resendResponse.ok) {
    debug.push({step: "Evaluate Resend result", status: "error", detail: data.error?.message ?? `Status ${resendResponse.status}`});
    return NextResponse.json(
      {error: data.error?.name ?? "Resend API error", detail: data.error?.message ?? `Status ${resendResponse.status}`, debug},
      {status: resendResponse.status},
    );
  }
  debug.push({step: "Evaluate Resend result", status: "ok", detail: `Email queued with ID: ${data.id}`});

  return NextResponse.json({ok: true, messageId: data.id, debug});
}
