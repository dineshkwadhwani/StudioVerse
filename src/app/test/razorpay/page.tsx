'use client';

import { FormEvent, useEffect, useState } from "react";

type DebugStep = { step: string; status: "ok" | "error" | "info"; detail?: string };

type CreateOrderResponse = {
  ok: boolean;
  orderId?: string;
  amountPaise?: number;
  currency?: string;
  receipt?: string;
  keyId?: string;
  error?: string;
  debug?: DebugStep[];
};

type VerifyResponse = {
  ok: boolean;
  payment?: { id: string; order_id: string; amount: number; status: string; method?: string; captured?: boolean };
  error?: string;
  debug?: DebugStep[];
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (response: unknown) => void) => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function RazorpayTestPage() {
  const [amountInr, setAmountInr] = useState("10");
  const [receipt, setReceipt] = useState(`test_${Date.now()}`);
  const [name, setName] = useState("Test Customer");
  const [email, setEmail] = useState("test@example.com");
  const [contact, setContact] = useState("9999999999");

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [createDebug, setCreateDebug] = useState<DebugStep[]>([]);
  const [verifyDebug, setVerifyDebug] = useState<DebugStep[]>([]);
  const [paymentResult, setPaymentResult] = useState<VerifyResponse["payment"] | null>(null);

  useEffect(() => {
    void loadCheckoutScript();
  }, []);

  const reset = () => {
    setErrorText("");
    setCreateDebug([]);
    setVerifyDebug([]);
    setPaymentResult(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reset();

    const amountNum = Number(amountInr);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setErrorText("Amount must be a positive number.");
      return;
    }

    setLoading(true);
    try {
      const orderRes = await fetch("/api/test/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr: amountNum, receipt: receipt.trim() }),
      });
      const orderData = (await orderRes.json()) as CreateOrderResponse;
      setCreateDebug(orderData.debug ?? []);

      if (!orderRes.ok || !orderData.ok || !orderData.orderId || !orderData.keyId || !orderData.amountPaise) {
        setErrorText(`Create order failed: ${orderData.error ?? `HTTP ${orderRes.status}`}`);
        return;
      }

      const scriptOk = await loadCheckoutScript();
      if (!scriptOk || !window.Razorpay) {
        setErrorText("Failed to load Razorpay checkout script.");
        return;
      }

      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amountPaise,
        currency: orderData.currency ?? "INR",
        name: "StudioVerse Test",
        description: `Razorpay test charge — receipt ${orderData.receipt}`,
        order_id: orderData.orderId,
        prefill: { name: name.trim(), email: email.trim(), contact: contact.trim() },
        notes: { receipt: orderData.receipt ?? "" },
        theme: { color: "#2563eb" },
        handler: async (response: unknown) => {
          const r = response as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
          try {
            const verifyRes = await fetch("/api/test/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: r.razorpay_order_id,
                razorpayPaymentId: r.razorpay_payment_id,
                razorpaySignature: r.razorpay_signature,
              }),
            });
            const verifyData = (await verifyRes.json()) as VerifyResponse;
            setVerifyDebug(verifyData.debug ?? []);
            if (!verifyRes.ok || !verifyData.ok) {
              setErrorText(`Verify failed: ${verifyData.error ?? `HTTP ${verifyRes.status}`}`);
              return;
            }
            setPaymentResult(verifyData.payment ?? null);
          } catch (err) {
            setErrorText(`Verify network error: ${err instanceof Error ? err.message : String(err)}`);
          }
        },
        modal: {
          ondismiss: () => {
            setErrorText("Checkout dismissed by user.");
          },
        },
      });

      checkout.on("payment.failed", (response: unknown) => {
        const r = response as { error?: { description?: string; code?: string } };
        setErrorText(`Payment failed: ${r.error?.description ?? "unknown"} (${r.error?.code ?? "n/a"})`);
      });

      checkout.open();
    } catch (err) {
      setErrorText(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 15,
    boxSizing: "border-box",
  };

  const renderDebug = (title: string, steps: DebugStep[]) => {
    if (steps.length === 0) return null;
    return (
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 8,
                background: s.status === "ok" ? "#f0fdf4" : s.status === "error" ? "#fef2f2" : "#f8fafc",
                border: `1px solid ${s.status === "ok" ? "#86efac" : s.status === "error" ? "#fca5a5" : "#e2e8f0"}`,
              }}
            >
              <span style={{ fontSize: 16 }}>
                {s.status === "ok" ? "✅" : s.status === "error" ? "❌" : "ℹ️"}
              </span>
              <div>
                <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{i + 1}. {s.step}</p>
                {s.detail && (
                  <pre style={{ margin: "4px 0 0", fontSize: 12, whiteSpace: "pre-wrap", color: "#374151", wordBreak: "break-all" }}>
                    {s.detail}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 30, marginBottom: 10 }}>Razorpay Payment Test</h1>
      <p style={{ color: "#4b5563", marginBottom: 24 }}>
        Creates a Razorpay order via <code>/api/test/razorpay/create-order</code>, opens checkout, then verifies the
        signature via <code>/api/test/razorpay/verify</code>. Default cart is <strong>₹10</strong> with a random
        receipt id.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Amount (INR)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={amountInr}
            onChange={(e) => setAmountInr(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Receipt ID</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setReceipt(`test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`)}
              style={{ padding: "0 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}
            >
              Randomize
            </button>
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Name (prefill)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Email (prefill)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>Contact (prefill)</label>
          <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} style={inputStyle} />
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 24px",
              background: loading ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Creating order…" : "Pay with Razorpay"}
          </button>
        </div>
      </form>

      {errorText && (
        <pre style={{ marginTop: 20, padding: 14, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", whiteSpace: "pre-wrap", fontSize: 14 }}>
          {errorText}
        </pre>
      )}

      {paymentResult && (
        <div style={{ marginTop: 20, padding: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
          <p style={{ color: "#15803d", fontWeight: 600, marginBottom: 4 }}>Payment verified!</p>
          <pre style={{ color: "#166534", fontSize: 13, margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(paymentResult, null, 2)}
          </pre>
        </div>
      )}

      {renderDebug("Create Order Steps", createDebug)}
      {renderDebug("Verify Steps", verifyDebug)}
    </div>
  );
}
