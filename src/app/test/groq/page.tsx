'use client';

import {FormEvent, useState} from "react";

type UsageInfo = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
} | null;

export default function GroqTestPage() {
  const [prompt, setPrompt] = useState("");
  const [responseText, setResponseText] = useState("");
  const [usage, setUsage] = useState<UsageInfo>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorText("Please enter a prompt.");
      return;
    }

    setLoading(true);
    setErrorText("");
    setResponseText("");
    setUsage(null);

    try {
      const res = await fetch("/api/test/groq", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({prompt: cleanPrompt}),
      });

      const data = await res.json() as {
        response?: string;
        usage?: UsageInfo;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        setErrorText(`Error (${res.status}): ${data.error ?? "Unknown error"}${data.detail ? `\n\n${data.detail}` : ""}`);
        return;
      }

      setResponseText(data.response ?? "No response received.");
      setUsage(data.usage ?? null);
    } catch (err) {
      setErrorText(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{maxWidth: 860, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif"}}>
      <h1 style={{fontSize: 30, marginBottom: 10}}>Groq Integration Test</h1>
      <p style={{color: "#4b5563", marginBottom: 20}}>
        Type a prompt and verify the Groq response. Uses <code>/test/groq</code> Next.js API route — no emulator required.
      </p>

      <form onSubmit={handleSubmit} style={{display: "grid", gap: 12}}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Type your prompt here..."
          rows={8}
          style={{width: "100%", padding: 12, borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, boxSizing: "border-box"}}
        />
        <div style={{display: "flex", gap: 10, alignItems: "center"}}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: 8,
              background: loading ? "#9ca3af" : "#111827",
              color: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15,
            }}
          >
            {loading ? "Sending…" : "Send Prompt"}
          </button>
          {loading && (
            <span style={{color: "#6b7280", fontSize: 13}}>Waiting for Groq…</span>
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

      {responseText ? (
        <div style={{marginTop: 24}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8}}>
            <h2 style={{fontSize: 18, margin: 0}}>Response</h2>
            {usage ? (
              <span style={{fontSize: 12, color: "#9ca3af"}}>
                {usage.prompt_tokens} prompt / {usage.completion_tokens} completion / {usage.total_tokens} total tokens
              </span>
            ) : null}
          </div>
          <pre style={{
            whiteSpace: "pre-wrap",
            margin: 0,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            {responseText}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
