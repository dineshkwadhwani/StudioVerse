import { NextResponse } from "next/server";
import { fetchRazorpayPayment, verifyRazorpaySignature } from "@/lib/payments/razorpay";

type DebugStep = { step: string; status: "ok" | "error" | "info"; detail?: string };

export async function POST(request: Request) {
  const debug: DebugStep[] = [];
  try {
    const body = (await request.json().catch(() => ({}))) as {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    const razorpayOrderId = (body.razorpayOrderId || "").trim();
    const razorpayPaymentId = (body.razorpayPaymentId || "").trim();
    const razorpaySignature = (body.razorpaySignature || "").trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { ok: false, error: "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required." },
        { status: 400 },
      );
    }

    debug.push({ step: "Inputs received", status: "info", detail: `orderId=${razorpayOrderId} paymentId=${razorpayPaymentId}` });

    const valid = verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature });
    if (!valid) {
      debug.push({ step: "Signature verification", status: "error", detail: "Signature mismatch" });
      return NextResponse.json({ ok: false, error: "Signature verification failed.", debug }, { status: 400 });
    }
    debug.push({ step: "Signature verified", status: "ok" });

    const payment = await fetchRazorpayPayment(razorpayPaymentId);
    debug.push({
      step: "Payment fetched",
      status: "ok",
      detail: `status=${payment.status} amount=${payment.amount} method=${payment.method ?? "n/a"} captured=${payment.captured ?? false}`,
    });

    return NextResponse.json({ ok: true, payment, debug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    debug.push({ step: "Verification failed", status: "error", detail: message });
    return NextResponse.json({ ok: false, error: message, debug }, { status: 500 });
  }
}
