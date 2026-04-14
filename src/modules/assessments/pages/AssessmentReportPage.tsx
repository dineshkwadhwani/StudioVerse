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
  const showRawAiResponse =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const tenantId = report?.tenantId ? report.tenantId : routeTenantId;

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
      <main style={{ minHeight: "100vh", background: "#f0f5fa", padding: "20px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <Link
              href={`/${routeTenantId}/my-activities`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                color: "#1c4f73",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              ← Back to My activities
            </Link>
          </div>
          <section
            style={{
              background: "#fff",
              border: "1px solid #e4eef7",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 24, color: "#19334d", marginBottom: 12 }}>Assessment Report</h1>
            <p style={{ margin: 0, color: "#8b1f1f", fontSize: 16 }}>Invalid assignment id.</p>
          </section>
        </div>
      </main>
    );
  }

  const strengths = toList(report?.reportStructuredData?.strengths);
  const blindSpots = toList(report?.reportStructuredData?.blindSpots);
  const recommendations = toList(report?.reportStructuredData?.recommendations);
  const nextActions = toList(report?.reportStructuredData?.nextActions);

  const reportDateStr = report?.createdAt
    ? new Date(
        typeof report.createdAt === "object" && "toDate" in report.createdAt
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((report.createdAt as any).toDate() as Date)
          : report.createdAt
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <main style={{ minHeight: "100vh", background: "#f0f5fa", padding: "20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header with Back Button and Print Button */}
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link
            href={`/${tenantId}/my-activities`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 14,
              color: "#1c4f73",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← Back to My activities
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #9dc3dd",
              background: "#e8f3fc",
              color: "#1c4f73",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#d4e8f8";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#7ba8c9";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#e8f3fc";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#9dc3dd";
            }}
          >
            🖨️ Print Report
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e4eef7",
              borderRadius: 12,
              padding: 48,
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <p style={{ margin: 0, color: "#325370", fontSize: 16 }}>Loading your assessment report...</p>
          </section>
        )}

        {/* Error State */}
        {!loading && error && !report && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e4eef7",
              borderRadius: 12,
              padding: 32,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <h2 style={{ margin: 0, color: "#8b1f1f", marginBottom: 12 }}>Unable to load report</h2>
            <p style={{ margin: 0, color: "#325370", fontSize: 15 }}>{error}</p>
          </section>
        )}

        {/* Report Content */}
        {!loading && !error && report && (
          <>
            {/* Summary Card */}
            <section
              style={{
                background: "#fff",
                border: "1px solid #e4eef7",
                borderRadius: 12,
                padding: 32,
                marginBottom: 24,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #e4eef7" }}>
                <h1 style={{ margin: 0, fontSize: 28, color: "#19334d", marginBottom: 8 }}>Assessment Report</h1>
                <p style={{ margin: 0, color: "#446177", fontSize: 13 }}>Generated on {reportDateStr}</p>
              </div>

              <p style={{ margin: 0, fontSize: 16, color: "#325370", lineHeight: 1.7 }}>
                {report.reportSummary || "Your assessment has been analyzed and insights have been generated."}
              </p>
            </section>

            {/* Key Insights Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* Strengths */}
              {strengths.length > 0 && (
                <section
                  style={{
                    background: "#f0f9f4",
                    border: "1px solid #c8e6dc",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#1b5e3f" }}>
                    💪 Strengths
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                    {strengths.map((item) => (
                      <li key={item} style={{ marginBottom: 8, color: "#2d5a3d" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Blind Spots */}
              {blindSpots.length > 0 && (
                <section
                  style={{
                    background: "#fff5f0",
                    border: "1px solid #fbd9cd",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#a83e2e" }}>
                    ⚠️ Blind Spots
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                    {blindSpots.map((item) => (
                      <li key={item} style={{ marginBottom: 8, color: "#7a2f24" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Recommendations & Next Actions */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* Recommendations */}
              {recommendations.length > 0 && (
                <section
                  style={{
                    background: "#f8f5ff",
                    border: "1px solid #e4ddf7",
                    borderRadius: 10,
                    padding: 24,
                  }}
                >
                  <h2 style={{ margin: "0 0 16px 0", fontSize: 17, fontWeight: 600, color: "#2d2360", display: "flex", alignItems: "center", gap: 8 }}>
                    💡 Recommendations
                  </h2>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, listStyle: "none" }}>
                    {recommendations.map((item) => (
                      <li key={item} style={{ marginBottom: 10, paddingLeft: 0, color: "#325370", lineHeight: 1.6 }}>
                        <span style={{ display: "inline-block", marginRight: 8, color: "#5b68d8", fontWeight: 600 }}>
                          •
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Next Actions */}
              {nextActions.length > 0 && (
                <section
                  style={{
                    background: "#fffaf0",
                    border: "1px solid #fce4d6",
                    borderRadius: 10,
                    padding: 24,
                  }}
                >
                  <h2 style={{ margin: "0 0 16px 0", fontSize: 17, fontWeight: 600, color: "#6b4423", display: "flex", alignItems: "center", gap: 8 }}>
                    🎯 Next Actions
                  </h2>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, listStyle: "none" }}>
                    {nextActions.map((item) => (
                      <li key={item} style={{ marginBottom: 10, paddingLeft: 0, color: "#325370", lineHeight: 1.6 }}>
                        <span style={{ display: "inline-block", marginRight: 8, color: "#d97706", fontWeight: 600 }}>
                          →
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Raw AI Response (Dev only) */}
            {showRawAiResponse && report.aiResponseRaw && (
              <section
                style={{
                  background: "#fff",
                  border: "1px solid #e4eef7",
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 600, color: "#446177" }}>
                  🔬 Raw AI Response (Dev Only)
                </h3>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.5,
                    background: "#f7fbff",
                    border: "1px solid #d7e8f8",
                    borderRadius: 8,
                    padding: 12,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 300,
                    overflowY: "auto",
                    color: "#325370",
                  }}
                >
                  {report.aiResponseRaw}
                </pre>
              </section>
            )}

            {/* Footer Section */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e4eef7",
                borderRadius: 10,
                padding: 20,
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#446177" }}>
                AI Provider: <strong>{report.aiProvider}</strong> • Report ID: <strong>{report.id.slice(0, 8)}</strong>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
