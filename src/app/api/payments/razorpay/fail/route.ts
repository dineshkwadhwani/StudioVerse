import { NextRequest, NextResponse } from "next/server";

type FailBody = {
  reason?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FailBody;
    const reason = String(body.reason ?? "Payment failed or cancelled").trim();
    return NextResponse.json({ ok: true, reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update payment status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
