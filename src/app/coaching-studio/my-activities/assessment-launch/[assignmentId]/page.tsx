"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { updateAssignmentStatus } from "@/services/assignment.service";

export default function AssessmentLaunchPlaceholderPage() {
  const params = useParams<{ assignmentId: string }>();
  const [message, setMessage] = useState("Launching assessment...");

  useEffect(() => {
    const assignmentId = params?.assignmentId;
    if (!assignmentId) {
      setMessage("Invalid assessment assignment.");
      return;
    }

    void updateAssignmentStatus({ assignmentId, status: "completed" })
      .then(() => {
        setMessage("Assessment launched (placeholder). Status set to Complete.");
      })
      .catch(() => {
        setMessage("Assessment placeholder opened, but status update failed.");
      });
  }, [params]);

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f9ff", color: "#19334d" }}>
      <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
        <h1 style={{ margin: 0 }}>Assessment Launch</h1>
        <p style={{ marginTop: 10 }}>{message}</p>
        <p>This is a placeholder assessment runtime page.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Link href="/coaching-studio/my-activities">Back to My activities</Link>
          <Link href={`/coaching-studio/my-activities/assessment-report/${params?.assignmentId ?? ""}`}>
            Open Report
          </Link>
        </div>
      </section>
    </main>
  );
}
