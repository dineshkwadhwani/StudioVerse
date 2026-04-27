import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder, getRazorpayPublicConfig } from "@/lib/payments/razorpay";

type CreateOrderBody = {
  amountPaise?: number;
  receipt?: string;
  notes?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderBody;
    const amountPaise = Number(body.amountPaise ?? 0);
    const receipt = String(body.receipt ?? "").trim();

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: "amountPaise must be a positive number." }, { status: 400 });
    }

    if (!receipt) {
      return NextResponse.json({ error: "receipt is required." }, { status: 400 });
    }

    const rzpOrder = await createRazorpayOrder({
      amountPaise,
      receipt,
      notes: body.notes,
    });

    const { keyId } = getRazorpayPublicConfig();

    return NextResponse.json({
      ok: true,
      orderId: receipt,
      razorpayOrderId: rzpOrder.id,
      amountPaise,
      currency: "INR",
      keyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
