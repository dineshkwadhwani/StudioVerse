'use client';

import {FormEvent, useState} from "react";

type SendResult = {
  ok: boolean;
  messageId: number;
} | null;

export default function TelegramTestPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SendResult>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setErrorText("Please enter a message.");
      return;
    }

    setLoading(true);
    setErrorText("");
    setResult(null);

    try {
      const res = await fetch("/api/test/telegram", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message: cleanMessage}),
      });

      const data = await res.json() as {
        ok?: boolean;
        messageId?: number;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        setErrorText(`Error (${res.status}): ${data.error ?? "Unknown error"}${data.detail ? `\n${data.detail}` : ""}`);
        return;
      }

      setResult({ok: data.ok ?? false, messageId: data.messageId ?? 0});
    } catch (err) {
      setErrorText(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{maxWidth: 700, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif"}}>
      <h1 style={{fontSize: 30, marginBottom: 10}}>Telegram Integration Test</h1>
      <p style={{color: "#4b5563", marginBottom: 24}}>
        Type a message and send it to the configured Telegram chat via <code>/api/test/telegram</code>.
      </p>

      <form onSubmit={handleSubmit} style={{display: "grid", gap: 12}}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Type your message here…"
          rows={6}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: 15,
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
        <div style={{display: "flex", gap: 10, alignItems: "center"}}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: 8,
              background: loading ? "#9ca3af" : "#0088cc",
              color: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            {loading ? "Sending…" : "Send to Telegram"}
          </button>
          {loading && (
            <span style={{color: "#6b7280", fontSize: 13}}>Waiting for Telegram…</span>
          )}
        </div>
      </form>

      {errorText ? (
        <pre style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 8,
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          color: "#dc2626",
          whiteSpace: "pre-wrap",
          fontSize: 13,
        }}>
          {errorText}
        </pre>
      ) : null}

      {result ? (
        <div style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 8,
          border: "1px solid #bbf7d0",
          background: "#f0fdf4",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span style={{fontSize: 22}}>✅</span>
          <div>
            <p style={{margin: 0, fontWeight: 600, color: "#16a34a"}}>Message sent successfully</p>
            <p style={{margin: "4px 0 0", fontSize: 13, color: "#4b5563"}}>
              Telegram message ID: <strong>{result.messageId}</strong>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
