"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function AssessmentReportPlaceholderPage() {
  const params = useParams<{ assignmentId: string }>();

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f9ff", color: "#19334d" }}>
      <section style={{ maxWidth: 780, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
        <h1 style={{ margin: 0 }}>Assessment Report</h1>
        <p style={{ marginTop: 10 }}>This is a placeholder report page for assignment: {params?.assignmentId ?? "-"}.</p>
        <Link href="/coaching-studio/my-activities">Back to My activities</Link>
      </section>
    </main>
  );
}
