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

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    const isSignatureValid = verifyRazorpaySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isSignatureValid) {
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
    }

    let payment = await fetchRazorpayPayment(razorpayPaymentId);

    if (payment.status === "authorized") {
      const amountForCapture = expectedAmountPaise > 0 ? expectedAmountPaise : payment.amount;
      payment = await captureRazorpayPayment(razorpayPaymentId, amountForCapture);
    }

    if (payment.status !== "captured") {
      return NextResponse.json({ error: "Payment not captured." }, { status: 400 });
    }

    if (payment.order_id !== razorpayOrderId) {
      return NextResponse.json({ error: "Razorpay order mismatch." }, { status: 400 });
    }

    if (expectedAmountPaise > 0 && payment.amount !== expectedAmountPaise) {
      return NextResponse.json({ error: "Payment amount mismatch." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      paymentStatus: payment.status,
      paymentMethod: payment.method ?? "unknown",
      amountPaise: payment.amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
