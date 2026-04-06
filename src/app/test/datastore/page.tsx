'use client';
import { auth } from "@/services/firebase";
import { useEffect, useState } from "react";

export default function TestPage() {
  const [status, setStatus] = useState("Connecting...");

  useEffect(() => {
    if (auth) {
      setStatus("✅ Firebase Data store Connected Successfully!");
    } else {
      setStatus("❌ Connection Failed.");
    }
  }, []);

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontSize: '24px' }}>
      <h1>StudioVerse Database Test</h1>
      <p>{status}</p>
    </div>
  );
}