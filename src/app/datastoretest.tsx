'use client';
import { auth } from "@/services/firebase";
import { useMemo } from "react";

export default function TestPage() {
  const status = useMemo(
    () => (auth ? "✅ Firebase Connected Successfully!" : "❌ Connection Failed."),
    []
  );

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontSize: '24px' }}>
      <h1>StudioVerse Database Test</h1>
      <p>{status}</p>
    </div>
  );
}