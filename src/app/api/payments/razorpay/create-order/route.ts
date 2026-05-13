import { NextRequest, NextResponse } from "next/server";
import { createRazorpayOrder, getRazorpayPublicConfig, isLocalMode, createLocalMockOrder } from "@/lib/payments/razorpay";

type CreateOrderBody = {
  amountPaise?: number;
  receipt?: string;
  tenantId?: string;
  notes?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderBody;
    const amountPaise = Number(body.amountPaise ?? 0);
    const receipt = String(body.receipt ?? "").trim();
    const tenantId = String(body.tenantId ?? "").trim();

    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return NextResponse.json({ error: "amountPaise must be a positive number." }, { status: 400 });
    }

    if (!receipt) {
      return NextResponse.json({ error: "receipt is required." }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
    }

    if (isLocalMode()) {
      const mockOrder = createLocalMockOrder(receipt, amountPaise);
      return NextResponse.json({
        ok: true,
        orderId: receipt,
        razorpayOrderId: mockOrder.id,
        amountPaise,
        currency: "INR",
        keyId: "local_key_not_used",
        mode: "local",
      });
    }

    const rzpOrder = await createRazorpayOrder({
      amountPaise,
      receipt,
      tenantId,
      notes: body.notes,
    });

    const { keyId } = getRazorpayPublicConfig(tenantId);

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
