import { NextRequest, NextResponse } from "next/server";
import {
  captureRazorpayPayment,
  fetchRazorpayPayment,
  verifyRazorpaySignature,
} from "@/lib/payments/razorpay";

type VerifyBody = {
  expectedAmountPaise?: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VerifyBody;
    const razorpayOrderId = String(body.razorpayOrderId ?? "").trim();
    const razorpayPaymentId = String(body.razorpayPaymentId ?? "").trim();
    const razorpaySignature = String(body.razorpaySignature ?? "").trim();
    const expectedAmountPaise = Number(body.expectedAmountPaise ?? 0);

    console.log("[razorpay/verify] Received:", { razorpayOrderId, razorpayPaymentId, expectedAmountPaise });

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      console.log("[razorpay/verify] REJECTED: missing fields");
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    const isSignatureValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    console.log("[razorpay/verify] Signature valid:", isSignatureValid);

    if (!isSignatureValid) {
      console.log("[razorpay/verify] REJECTED: invalid signature");
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
    }

    let payment = await fetchRazorpayPayment(razorpayPaymentId);
    console.log("[razorpay/verify] Payment status after fetch:", payment.status);

    if (payment.status === "authorized") {
      const amountForCapture = expectedAmountPaise > 0 ? expectedAmountPaise : payment.amount;
      console.log("[razorpay/verify] Capturing payment:", { razorpayPaymentId, amountForCapture });
      payment = await captureRazorpayPayment(razorpayPaymentId, amountForCapture);
      console.log("[razorpay/verify] Payment status after capture:", payment.status);
    }

    if (payment.status !== "captured") {
      console.log("[razorpay/verify] REJECTED: payment not captured, status:", payment.status);
      return NextResponse.json({ error: "Payment not captured." }, { status: 400 });
    }

    if (payment.order_id !== razorpayOrderId) {
      console.log("[razorpay/verify] REJECTED: order mismatch", { expected: razorpayOrderId, got: payment.order_id });
      return NextResponse.json({ error: "Razorpay order mismatch." }, { status: 400 });
    }

    if (expectedAmountPaise > 0 && payment.amount !== expectedAmountPaise) {
      console.log("[razorpay/verify] REJECTED: amount mismatch", { expected: expectedAmountPaise, got: payment.amount });
      return NextResponse.json({ error: "Payment amount mismatch." }, { status: 400 });
    }

    console.log("[razorpay/verify] SUCCESS:", { paymentStatus: payment.status, method: payment.method, amountPaise: payment.amount });

    return NextResponse.json({
      ok: true,
      paymentStatus: payment.status,
      paymentMethod: payment.method ?? "unknown",
      amountPaise: payment.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment.";
    console.error("[razorpay/verify] ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
