"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { getLatestAssessmentReportByAssignmentId } from "@/services/assessment-runtime.service";
import type { AssessmentReportRecord } from "@/types/assessment";

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

export default function AssessmentReportPage() {
  const params = useParams<{ assignmentId: string }>();
  const pathname = usePathname();
  const assignmentId = params?.assignmentId ?? "";
  const [report, setReport] = useState<AssessmentReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const routeTenantId = pathname.split("/")[1] || "coaching-studio";
  const basePath = report?.tenantId ? `/${report.tenantId}` : `/${routeTenantId}`;
  const showRawAiResponse =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (!assignmentId) {
      return;
    }

    void getLatestAssessmentReportByAssignmentId(assignmentId)
      .then((row) => {
        if (!row) {
          setError("No assessment report found yet. Complete the assessment first.");
          return;
        }

        setReport(row);
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : "Failed to load report.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assignmentId]);

  if (!assignmentId) {
    return (
      <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f9ff", color: "#19334d" }}>
        <section style={{ maxWidth: 900, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
          <h1 style={{ margin: 0 }}>Assessment Report</h1>
          <p style={{ marginTop: 10, color: "#8b1f1f" }}>Invalid assignment id.</p>
          <Link href={`${basePath}/my-activities`}>Back to My activities</Link>
        </section>
      </main>
    );
  }

  const strengths = toList(report?.reportStructuredData?.strengths);
  const blindSpots = toList(report?.reportStructuredData?.blindSpots);
  const recommendations = toList(report?.reportStructuredData?.recommendations);
  const nextActions = toList(report?.reportStructuredData?.nextActions);

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#f4f9ff", color: "#19334d" }}>
      <section style={{ maxWidth: 900, margin: "0 auto", background: "#fff", border: "1px solid #d7e8f8", borderRadius: 14, padding: 18 }}>
        <h1 style={{ margin: 0 }}>Assessment Report</h1>

        {loading ? <p style={{ marginTop: 10 }}>Loading report...</p> : null}
        {!loading && error ? <p style={{ marginTop: 10, color: "#8b1f1f" }}>{error}</p> : null}

        {!loading && !error && report ? (
          <>
            <p style={{ marginTop: 10 }}>{report.reportSummary || "Assessment report generated."}</p>
            <p style={{ marginTop: 6, color: "#446177", fontSize: 14 }}>AI Provider: {report.aiProvider}</p>

            {strengths.length > 0 ? (
              <section style={{ marginTop: 14 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Strengths</h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {blindSpots.length > 0 ? (
              <section style={{ marginTop: 14 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Blind Spots</h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {blindSpots.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {recommendations.length > 0 ? (
              <section style={{ marginTop: 14 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Recommendations</h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {nextActions.length > 0 ? (
              <section style={{ marginTop: 14 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Next Actions</h2>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {nextActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showRawAiResponse && report.aiResponseRaw ? (
              <section style={{ marginTop: 14 }}>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Raw AI Response</h2>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.5,
                    background: "#f7fbff",
                    border: "1px solid #d7e8f8",
                    borderRadius: 10,
                    padding: 12,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {report.aiResponseRaw}
                </pre>
              </section>
            ) : null}
          </>
        ) : null}

        <Link href={`${basePath}/my-activities`}>Back to My activities</Link>
      </section>
    </main>
  );
}
