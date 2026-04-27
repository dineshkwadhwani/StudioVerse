import crypto from "node:crypto";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  method?: string;
  captured?: boolean;
};

function toBase64(value: string): string {
  return Buffer.from(value).toString("base64");
}

function resolveEnvMode(): "test" | "live" {
  const explicitMode = (process.env.RAZORPAY_MODE || "").trim().toLowerCase();
  if (explicitMode === "live") return "live";
  if (explicitMode === "test") return "test";

  const appEnv = (
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NODE_ENV ||
    "development"
  )
    .trim()
    .toLowerCase();

  return appEnv === "production" ? "live" : "test";
}

function resolveRazorpayKeys(): { keyId: string; keySecret: string } {
  const explicitKeyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const explicitKeySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (explicitKeyId || explicitKeySecret) {
    return { keyId: explicitKeyId, keySecret: explicitKeySecret };
  }

  const mode = resolveEnvMode();
  const keyId = (
    mode === "live"
      ? process.env.RAZORPAY_LIVE_API_KEY
      : process.env.RAZORPAY_TEST_API_KEY
  )?.trim() || "";

  const keySecret = (
    mode === "live"
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_TEST_KEY_SECRET
  )?.trim() || "";

  return { keyId, keySecret };
}

function readKeyId(): string {
  const { keyId } = resolveRazorpayKeys();
  if (keyId) return keyId;
  return (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
}

function readKeySecret(): string {
  const { keySecret } = resolveRazorpayKeys();
  return keySecret;
}

export function getRazorpayPublicConfig() {
  const keyId = readKeyId();
  if (!keyId) {
    throw new Error("Razorpay key ID is not configured.");
  }
  return { keyId };
}

function getRazorpayAuthHeader(): string {
  const keyId = readKeyId();
  const keySecret = readKeySecret();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }
  return `Basic ${toBase64(`${keyId}:${keySecret}`)}`;
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: getRazorpayAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = typeof data.error === "object" && data.error && "description" in data.error
      ? String((data.error as { description?: unknown }).description ?? "Razorpay order creation failed")
      : "Razorpay order creation failed";
    throw new Error(detail);
  }

  return data as unknown as RazorpayOrderResponse;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: getRazorpayAuthHeader(),
    },
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error("Failed to fetch Razorpay payment details.");
  }
  return data as unknown as RazorpayPaymentResponse;
}

export async function captureRazorpayPayment(paymentId: string, amountPaise: number): Promise<RazorpayPaymentResponse> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: getRazorpayAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR" }),
  });

  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error("Failed to capture Razorpay payment.");
  }
  return data as unknown as RazorpayPaymentResponse;
}

export function verifyRazorpaySignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  const keySecret = readKeySecret();
  if (!keySecret) {
    throw new Error("Razorpay secret is not configured.");
  }

  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  return expected === input.razorpaySignature;
}
