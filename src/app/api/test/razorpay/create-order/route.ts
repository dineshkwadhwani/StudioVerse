import { NextResponse } from "next/server";
import { createRazorpayOrder, getRazorpayPublicConfig } from "@/lib/payments/razorpay";

type DebugStep = { step: string; status: "ok" | "error" | "info"; detail?: string };

export async function POST(request: Request) {
  const debug: DebugStep[] = [];
  try {
    const body = (await request.json().catch(() => ({}))) as {
      amountInr?: number;
      receipt?: string;
      tenantId?: string;
    };

    const amountInr = Number.isFinite(body.amountInr) && (body.amountInr ?? 0) > 0 ? Number(body.amountInr) : 10;
    const amountPaise = Math.round(amountInr * 100);
    const receipt =
      typeof body.receipt === "string" && body.receipt.trim()
        ? body.receipt.trim()
        : `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tenantId = typeof body.tenantId === "string" && body.tenantId.trim() ? body.tenantId.trim() : undefined;

    debug.push({ step: "Inputs resolved", status: "info", detail: `amountInr=${amountInr} amountPaise=${amountPaise} receipt=${receipt}` });

    const { keyId } = getRazorpayPublicConfig(tenantId);
    debug.push({ step: "Razorpay public config loaded", status: "ok", detail: `keyId=${keyId} tenant=${tenantId ?? "(none)"}` });

    const order = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: { source: "test-page" },
      tenantId,
    });
    debug.push({ step: "Order created", status: "ok", detail: `orderId=${order.id} amount=${order.amount} currency=${order.currency}` });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      receipt,
      keyId,
      debug,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debug.push({ step: "Order creation failed", status: "error", detail: message });
    return NextResponse.json({ ok: false, error: message, debug }, { status: 500 });
  }
}
