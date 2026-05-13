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

function resolveEnvMode(): "test" | "live" | "local" {
  const explicitMode = (process.env.RAZORPAY_MODE || "").trim().toLowerCase();
  if (explicitMode === "local") return "local";
  if (explicitMode === "live") return "live";
  if (explicitMode === "test") return "test";

  const appEnv = (
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    ""
  )
    .trim()
    .toLowerCase();

  return appEnv === "production" ? "live" : "test";
}

export function isLocalMode(): boolean {
  return resolveEnvMode() === "local";
}

export function createLocalMockOrder(receipt: string, amountPaise: number): RazorpayOrderResponse {
  return {
    id: `local_order_${receipt}_${Date.now()}`,
    amount: amountPaise,
    currency: "INR",
    receipt,
    status: "created",
  };
}

export function createLocalMockPaymentVerification(_razorpayOrderId: string, amountPaise: number) {
  return {
    paymentStatus: "captured" as const,
    paymentMethod: "local_emulator",
    amountPaise,
  };
}

function normalizeTenantEnvPrefix(tenantId?: string): string {
  if (!tenantId) return "";
  return tenantId
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveRazorpayKeys(tenantId?: string): { keyId: string; keySecret: string } {
  const mode = resolveEnvMode();
  const modePrefix = mode === "live" ? "LIVE" : "TEST";
  const tenantPrefix = normalizeTenantEnvPrefix(tenantId);

  if (tenantPrefix) {
    const tenantModeKeyId = process.env[`RAZORPAY_${tenantPrefix}_${modePrefix}_API_KEY`]?.trim() || "";
    const tenantModeKeySecret = process.env[`RAZORPAY_${tenantPrefix}_${modePrefix}_KEY_SECRET`]?.trim() || "";
    if (tenantModeKeyId && tenantModeKeySecret) {
      return { keyId: tenantModeKeyId, keySecret: tenantModeKeySecret };
    }

    const tenantKeyId = process.env[`RAZORPAY_${tenantPrefix}_API_KEY`]?.trim() || "";
    const tenantKeySecret = process.env[`RAZORPAY_${tenantPrefix}_KEY_SECRET`]?.trim() || "";
    if (tenantKeyId && tenantKeySecret) {
      return { keyId: tenantKeyId, keySecret: tenantKeySecret };
    }
  }

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

function readKeyId(tenantId?: string): string {
  const { keyId } = resolveRazorpayKeys(tenantId);
  if (keyId) return keyId;
  return (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
}

function readKeySecret(tenantId?: string): string {
  const { keySecret } = resolveRazorpayKeys(tenantId);
  return keySecret;
}

export function getRazorpayPublicConfig(tenantId?: string) {
  const keyId = readKeyId(tenantId);
  if (!keyId) {
    throw new Error(`Razorpay key ID is not configured${tenantId ? ` for tenant ${tenantId}` : ""}.`);
  }
  return { keyId };
}

function getRazorpayAuthHeader(tenantId?: string): string {
  const keyId = readKeyId(tenantId);
  const keySecret = readKeySecret(tenantId);
  if (!keyId || !keySecret) {
    throw new Error(`Razorpay credentials are not configured${tenantId ? ` for tenant ${tenantId}` : ""}.`);
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
  tenantId?: string;
}): Promise<RazorpayOrderResponse> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: getRazorpayAuthHeader(input.tenantId),
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

export async function fetchRazorpayPayment(paymentId: string, tenantId?: string): Promise<RazorpayPaymentResponse> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: getRazorpayAuthHeader(tenantId),
    },
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error("Failed to fetch Razorpay payment details.");
  }
  return data as unknown as RazorpayPaymentResponse;
}

export async function captureRazorpayPayment(paymentId: string, amountPaise: number, tenantId?: string): Promise<RazorpayPaymentResponse> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: getRazorpayAuthHeader(tenantId),
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
  tenantId?: string;
}): boolean {
  const keySecret = readKeySecret(input.tenantId);
  if (!keySecret) {
    throw new Error("Razorpay secret is not configured.");
  }

  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  return expected === input.razorpaySignature;
}
