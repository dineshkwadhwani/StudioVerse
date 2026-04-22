'use client';

import {FormEvent, useState} from "react";

type DebugStep = {step: string; status: "ok" | "error" | "info"; detail?: string};

type SendResult = {
  ok: boolean;
  messageId: string;
  debug: DebugStep[];
} | null;

export default function ResendTestPage() {
  const [to, setTo] = useState("");
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [result, setResult] = useState<SendResult>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!to.trim() || !fromName.trim() || !subject.trim() || !emailBody.trim()) {
      setErrorText("All fields are required.");
      return;
    }

    setLoading(true);
    setErrorText("");
    setResult(null);

    try {
      const res = await fetch("/api/test/resend", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({to: to.trim(), fromName: fromName.trim(), subject: subject.trim(), emailBody: emailBody.trim()}),
      });

      const data = await res.json() as {
        ok?: boolean;
        messageId?: string;
        error?: string;
        detail?: string;
        debug?: DebugStep[];
      };

      if (!res.ok) {
        setErrorText(`Error (${res.status}): ${data.error ?? "Unknown error"}${data.detail ? `\n${data.detail}` : ""}`);
        if (data.debug) setResult({ok: false, messageId: "", debug: data.debug});
        return;
      }

      setResult({ok: data.ok ?? false, messageId: data.messageId ?? "", debug: data.debug ?? []});
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

  const debugSteps = Array.isArray(result?.debug) ? result.debug : [];

  return (
    <div style={{maxWidth: 700, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif"}}>
      <h1 style={{fontSize: 30, marginBottom: 10}}>Resend Email Test</h1>
      <p style={{color: "#4b5563", marginBottom: 24}}>
        Send a test email via <code>/api/test/resend</code>. Sender is always{" "}
        <strong>contact@coachingstudio.in</strong>.
      </p>

      <form onSubmit={handleSubmit} style={{display: "grid", gap: 14}}>
        <div>
          <label style={{display: "block", marginBottom: 4, fontWeight: 600}}>To</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{display: "block", marginBottom: 4, fontWeight: 600}}>From Name</label>
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Coaching Studio"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{display: "block", marginBottom: 4, fontWeight: 600}}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{display: "block", marginBottom: 4, fontWeight: 600}}>Body</label>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Email body text…"
            rows={6}
            style={{...inputStyle, resize: "vertical"}}
          />
        </div>

        <div style={{display: "flex", gap: 10, alignItems: "center"}}>
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
            {loading ? "Sending…" : "Send Email"}
          </button>
        </div>
      </form>

      {errorText && (
        <pre style={{marginTop: 20, padding: 14, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#b91c1c", whiteSpace: "pre-wrap", fontSize: 14}}>
          {errorText}
        </pre>
      )}

      {result && (
        <>
          {result.ok && (
            <div style={{marginTop: 20, padding: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8}}>
              <p style={{color: "#15803d", fontWeight: 600, marginBottom: 4}}>Email sent successfully!</p>
              <p style={{color: "#166534", fontSize: 14}}>Message ID: <code>{result.messageId}</code></p>
            </div>
          )}

          {debugSteps.length > 0 && (
            <div style={{marginTop: 24}}>
              <h2 style={{fontSize: 18, fontWeight: 700, marginBottom: 12}}>Debug Steps</h2>
              <div style={{display: "grid", gap: 8}}>
                {debugSteps.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr",
                      gap: 10,
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: s.status === "ok" ? "#f0fdf4" : s.status === "error" ? "#fef2f2" : "#f8fafc",
                      border: `1px solid ${s.status === "ok" ? "#86efac" : s.status === "error" ? "#fca5a5" : "#e2e8f0"}`
                    }}
                  >
                    <span style={{fontSize: 16}}>
                      {s.status === "ok" ? "✅" : s.status === "error" ? "❌" : "ℹ️"}
                    </span>
                    <div>
                      <p style={{fontWeight: 600, margin: 0, fontSize: 14}}>{i + 1}. {s.step}</p>
                      {s.detail && (
                        <pre style={{margin: "4px 0 0", fontSize: 12, whiteSpace: "pre-wrap", color: "#374151", wordBreak: "break-all"}}>
                          {s.detail}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
