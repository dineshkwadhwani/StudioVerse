"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";
import {
  DEFAULT_REPORT_STYLE,
  REPORT_STYLE_LABELS,
  REPORT_STYLE_SECTIONS,
} from "@/modules/assessments/report-styles";
import {
  getAssessmentReportRecommendations,
  getLatestAssessmentReportByAssignmentId,
  type AssessmentReportRecommendation,
} from "@/services/assessment-runtime.service";
import { auth } from "@/services/firebase";
import type { AssessmentReportRecord, AssessmentReportStyle } from "@/types/assessment";

type UserRole = "company" | "professional" | "individual" | "superadmin";

function toList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

type ReportSectionViewModel = {
  key: string;
  title: string;
  items: string[];
  tone: "positive" | "warning" | "neutral" | "action";
};

type ScoringRowViewModel = {
  label: string;
  score: string;
  reason: string;
};

type LegendRowViewModel = {
  label: string;
  meaning: string;
};

type ScoringTableViewModel = {
  items: ScoringRowViewModel[];
  legend: LegendRowViewModel[];
};

function isUserRole(value: unknown): value is UserRole {
  return value === "company" || value === "professional" || value === "individual" || value === "superadmin";
}

function toDetailItem(item: AssessmentReportRecommendation): DetailItem {
  return {
    id: item.activityId,
    type: item.activityType === "assessment" ? "tool" : item.activityType,
    title: item.activityTitle,
    image: item.imageUrl || "",
    description: item.shortDescription || item.details || item.activityTitle,
    details: item.details,
    creditsRequired: item.creditsRequired,
    cost: item.cost,
    deliveryType: item.deliveryType,
    durationValue: item.durationValue,
    durationUnit: item.durationUnit,
    facilitatorName: item.facilitatorName,
    videoUrl: item.videoUrl,
    eventType: item.eventType,
    eventDate: item.eventDate,
    eventTime: item.eventTime,
    locationCity: item.locationCity,
    locationAddress: item.locationAddress,
    assessmentContext: item.assessmentContext,
    assessmentBenefit: item.assessmentBenefit,
    assessmentType: item.assessmentType,
  };
}

function formatRecommendationType(item: AssessmentReportRecommendation): string {
  if (item.activityType === "assessment") {
    return item.assessmentType || "Assessment";
  }

  if (item.activityType === "event") {
    return item.eventType || "Event";
  }

  return item.deliveryType || "Program";
}

function pickFirstString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }

  return "";
}

function getScoringTable(report: AssessmentReportRecord | null): ScoringTableViewModel | null {
  const data = report?.reportStructuredData;
  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  const scoringCandidates = [row.scoringTable, row.scoreTable, row.scoring_table, row.score_table, row.scoring];
  const legendCandidates = [row.legendTable, row.legend_table, row.legend, row.scoringLegend, row.scoring_legend];

  const normalizeItems = (value: unknown): ScoringRowViewModel[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const item = entry as Record<string, unknown>;
        const label = pickFirstString(item, ["label", "title", "name", "metric", "criterion", "dimension", "category"]);
        const score = pickFirstString(item, ["score", "value", "rating", "band", "result"]);
        const reason = pickFirstString(item, ["reason", "why", "rationale", "explanation", "description", "justification"]);
        if (!score || !reason) {
          return null;
        }

        return {
          label,
          score,
          reason,
        };
      })
      .filter((entry): entry is ScoringRowViewModel => Boolean(entry));
  };

  const normalizeLegend = (value: unknown): LegendRowViewModel[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const item = entry as Record<string, unknown>;
        const label = pickFirstString(item, ["label", "score", "range", "band", "value", "title"]);
        const meaning = pickFirstString(item, ["meaning", "description", "interpretation", "explanation", "notes"]);
        if (!label || !meaning) {
          return null;
        }

        return {
          label,
          meaning,
        };
      })
      .filter((entry): entry is LegendRowViewModel => Boolean(entry));
  };

  for (const candidate of scoringCandidates) {
    const candidateRow = candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : null;
    const items = normalizeItems(
      Array.isArray(candidate)
        ? candidate
        : candidateRow?.items ?? candidateRow?.rows ?? candidateRow?.scores ?? candidateRow?.table
    );
    const legend = normalizeLegend(
      candidateRow?.legend ??
        candidateRow?.legendTable ??
        candidateRow?.legend_table ??
        legendCandidates.find(Boolean)
    );

    if (items.length > 0) {
      return { items, legend };
    }
  }

  const directItems = normalizeItems(row.scores ?? row.scoreRows ?? row.scoringRows);
  const directLegend = normalizeLegend(legendCandidates.find(Boolean));
  if (directItems.length > 0) {
    return { items: directItems, legend: directLegend };
  }

  return null;
}

function resolveReportStyle(report: AssessmentReportRecord | null): AssessmentReportStyle {
  if (report?.reportStyle) {
    return report.reportStyle;
  }

  const structuredStyle = report?.reportStructuredData?.reportStyle;
  if (typeof structuredStyle === "string" && structuredStyle in REPORT_STYLE_LABELS) {
    return structuredStyle as AssessmentReportStyle;
  }

  return DEFAULT_REPORT_STYLE;
}

function getReportSections(report: AssessmentReportRecord | null, reportStyle: AssessmentReportStyle): ReportSectionViewModel[] {
  const definitions = REPORT_STYLE_SECTIONS[reportStyle] ?? REPORT_STYLE_SECTIONS[DEFAULT_REPORT_STYLE];
  const structuredSections = report?.reportStructuredData?.sections;

  if (Array.isArray(structuredSections)) {
    const normalizedSections = structuredSections
      .map((section) => {
        if (!section || typeof section !== "object") {
          return null;
        }

        const row = section as Record<string, unknown>;
        const key = typeof row.key === "string" ? row.key.trim() : "";
        const definition = definitions.find((item) => item.key === key);
        const items = toList(row.items);
        if (!definition || items.length === 0) {
          return null;
        }

        return {
          key: definition.key,
          title: definition.title,
          items,
          tone: definition.tone,
        };
      })
      .filter((section): section is ReportSectionViewModel => Boolean(section));

    if (normalizedSections.length > 0) {
      return normalizedSections;
    }
  }

  const legacyBuckets = [
    toList(report?.reportStructuredData?.strengths),
    toList(report?.reportStructuredData?.blindSpots),
    toList(report?.reportStructuredData?.recommendations),
    toList(report?.reportStructuredData?.nextActions),
  ];

  return definitions
    .map((definition, index) => ({
      key: definition.key,
      title: definition.title,
      items: legacyBuckets[index] ?? [],
      tone: definition.tone,
    }))
    .filter((section) => section.items.length > 0);
}

const SECTION_STYLES = {
  positive: { background: "#f0f9f4", border: "#c8e6dc", title: "#1b5e3f", text: "#2d5a3d", marker: "#2a8f5a" },
  warning: { background: "#fff5f0", border: "#fbd9cd", title: "#a83e2e", text: "#7a2f24", marker: "#d15d42" },
  neutral: { background: "#f7f8fc", border: "#dde3f0", title: "#2d3b57", text: "#325370", marker: "#5b68d8" },
  action: { background: "#fffaf0", border: "#fce4d6", title: "#6b4423", text: "#325370", marker: "#d97706" },
} as const;

export default function AssessmentReportPage() {
  const params = useParams<{ assignmentId: string }>();
  const pathname = usePathname();
  const assignmentId = params?.assignmentId ?? "";
  const [report, setReport] = useState<AssessmentReportRecord | null>(null);
  const [recommendations, setRecommendations] = useState<AssessmentReportRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [viewerRole, setViewerRole] = useState<UserRole | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | undefined>();
  const [viewerName, setViewerName] = useState<string | undefined>();
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
        
        // Log detailed error information
        console.error("[AssessmentReportPage] Fetch Report Error", {
          timestamp: new Date().toISOString(),
          assignmentId,
          errorMessage: message,
          errorName: loadError instanceof Error ? loadError.name : "Unknown",
          errorStack: loadError instanceof Error ? loadError.stack : "No stack trace",
          fullError: loadError,
        });
        
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assignmentId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setViewerUserId(firebaseUser?.uid);
      setViewerName(firebaseUser?.displayName || sessionStorage.getItem("cs_name") || undefined);

      const storedRole = sessionStorage.getItem("cs_role");
      setViewerRole(isUserRole(storedRole) ? storedRole : null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!report?.assessmentId || !report.tenantId) {
      setRecommendations([]);
      return;
    }

    let active = true;
    setRecommendationsLoading(true);

    void getAssessmentReportRecommendations({
      tenantId: report.tenantId,
      assessmentId: report.assessmentId,
      limit: 5,
    })
      .then((items) => {
        if (active) {
          setRecommendations(items);
        }
      })
      .catch((loadError) => {
        console.error("[AssessmentReportPage] Fetch Recommendations Error", {
          timestamp: new Date().toISOString(),
          assessmentId: report.assessmentId,
          tenantId: report.tenantId,
          errorMessage: loadError instanceof Error ? loadError.message : "Unknown error",
          errorName: loadError instanceof Error ? loadError.name : "Unknown",
          errorStack: loadError instanceof Error ? loadError.stack : "No stack trace",
          fullError: loadError,
        });

        if (active) {
          setRecommendations([]);
        }
      })
      .finally(() => {
        if (active) {
          setRecommendationsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [report?.assessmentId, report?.tenantId]);

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

  const reportStyle = resolveReportStyle(report);
  const reportSections = getReportSections(report, reportStyle);
  const scoringTable = getScoringTable(report);
  const scoringHasLabels = scoringTable?.items.some((item) => item.label) ?? false;

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
                <p style={{ margin: 0, color: "#446177", fontSize: 13 }}>
                  Generated on {reportDateStr} • {REPORT_STYLE_LABELS[reportStyle]}
                </p>
              </div>

              <p style={{ margin: 0, fontSize: 16, color: "#325370", lineHeight: 1.7 }}>
                {report.reportSummary || "Your assessment has been analyzed and insights have been generated."}
              </p>
            </section>

            {reportSections.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {reportSections.map((section) => {
                  const palette = SECTION_STYLES[section.tone];
                  return (
                    <section
                      key={section.key}
                      style={{
                        background: palette.background,
                        border: `1px solid ${palette.border}`,
                        borderRadius: 10,
                        padding: 22,
                      }}
                    >
                      <h2
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: 17,
                          fontWeight: 600,
                          color: palette.title,
                        }}
                      >
                        {section.title}
                      </h2>
                      <ul style={{ margin: 0, paddingLeft: 0, fontSize: 14, listStyle: "none" }}>
                        {section.items.map((item) => (
                          <li key={item} style={{ marginBottom: 10, color: palette.text, lineHeight: 1.6 }}>
                            <span
                              style={{
                                display: "inline-block",
                                marginRight: 8,
                                color: palette.marker,
                                fontWeight: 700,
                              }}
                            >
                              •
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}

            {scoringTable ? (
              <section
                style={{
                  background: "#fff",
                  border: "1px solid #e4eef7",
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 600, color: "#19334d" }}>
                    Scoring Table
                  </h2>
                  <p style={{ margin: 0, fontSize: 14, color: "#446177", lineHeight: 1.6 }}>
                    Score breakdown with rationale from the assessment analysis.
                  </p>
                </div>

                <div style={{ overflowX: "auto", marginBottom: scoringTable.legend.length > 0 ? 18 : 0 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: scoringHasLabels ? 680 : 520,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f7fbff" }}>
                        {scoringHasLabels ? (
                          <th
                            style={{
                              textAlign: "left",
                              padding: "12px 14px",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#325370",
                              borderBottom: "1px solid #d7e8f8",
                            }}
                          >
                            Dimension
                          </th>
                        ) : null}
                        <th
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#325370",
                            borderBottom: "1px solid #d7e8f8",
                            width: scoringHasLabels ? "18%" : "22%",
                          }}
                        >
                          Score
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "12px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#325370",
                            borderBottom: "1px solid #d7e8f8",
                          }}
                        >
                          Why This Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoringTable.items.map((item, index) => (
                        <tr key={`${item.label}-${item.score}-${index}`}>
                          {scoringHasLabels ? (
                            <td
                              style={{
                                padding: "14px",
                                fontSize: 14,
                                color: "#19334d",
                                borderBottom: "1px solid #eef4fa",
                                verticalAlign: "top",
                                fontWeight: 600,
                              }}
                            >
                              {item.label || "Overall"}
                            </td>
                          ) : null}
                          <td
                            style={{
                              padding: "14px",
                              fontSize: 14,
                              color: "#1c4f73",
                              borderBottom: "1px solid #eef4fa",
                              verticalAlign: "top",
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.score}
                          </td>
                          <td
                            style={{
                              padding: "14px",
                              fontSize: 14,
                              color: "#325370",
                              borderBottom: "1px solid #eef4fa",
                              lineHeight: 1.6,
                              verticalAlign: "top",
                            }}
                          >
                            {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scoringTable.legend.length > 0 ? (
                  <div>
                    <h3 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 600, color: "#19334d" }}>
                      Legend
                    </h3>
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          minWidth: 420,
                        }}
                      >
                        <thead>
                          <tr style={{ background: "#f7fbff" }}>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px 14px",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#325370",
                                borderBottom: "1px solid #d7e8f8",
                                width: "24%",
                              }}
                            >
                              Score
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "12px 14px",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#325370",
                                borderBottom: "1px solid #d7e8f8",
                              }}
                            >
                              Meaning
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {scoringTable.legend.map((item, index) => (
                            <tr key={`${item.label}-${index}`}>
                              <td
                                style={{
                                  padding: "14px",
                                  fontSize: 14,
                                  color: "#1c4f73",
                                  borderBottom: "1px solid #eef4fa",
                                  verticalAlign: "top",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.label}
                              </td>
                              <td
                                style={{
                                  padding: "14px",
                                  fontSize: 14,
                                  color: "#325370",
                                  borderBottom: "1px solid #eef4fa",
                                  lineHeight: 1.6,
                                  verticalAlign: "top",
                                }}
                              >
                                {item.meaning}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {(recommendationsLoading || recommendations.length > 0) ? (
              <section
                style={{
                  background: "#fff",
                  border: "1px solid #e4eef7",
                  borderRadius: 10,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 600, color: "#19334d" }}>
                    Our Recommendations
                  </h2>
                  <p style={{ margin: 0, fontSize: 14, color: "#446177", lineHeight: 1.6 }}>
                    Programs, events, and assessments aligned to the same category and sub category.
                  </p>
                </div>

                {recommendationsLoading ? (
                  <p style={{ margin: 0, fontSize: 14, color: "#446177" }}>Loading recommendations...</p>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {recommendations.map((item) => (
                      <div
                        key={`${item.activityType}:${item.activityId}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 16,
                          padding: 16,
                          border: "1px solid #e4eef7",
                          borderRadius: 10,
                          background: "#f9fcff",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 600, color: "#19334d" }}>
                            {item.activityTitle}
                          </p>
                          <p style={{ margin: "0 0 8px 0", fontSize: 13, color: "#1c4f73", fontWeight: 600 }}>
                            {formatRecommendationType(item)}
                          </p>
                          <p style={{ margin: 0, fontSize: 14, color: "#446177", lineHeight: 1.6 }}>
                            {item.shortDescription || item.details || "Explore this recommended resource."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(toDetailItem(item))}
                          style={{
                            flexShrink: 0,
                            border: "1px solid #cddfee",
                            background: "#fff",
                            color: "#1c4f73",
                            borderRadius: 999,
                            padding: "10px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Find More
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

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
                {report.analysisPromptUsed ? (
                  <>
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#446177",
                      }}
                    >
                      🧠 Effective Analysis Prompt
                    </h4>
                    <pre
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: 12,
                        lineHeight: 1.5,
                        background: "#f7fbff",
                        border: "1px solid #d7e8f8",
                        borderRadius: 8,
                        padding: 12,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: 260,
                        overflowY: "auto",
                        color: "#325370",
                      }}
                    >
                      {report.analysisPromptUsed}
                    </pre>
                  </>
                ) : null}
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

      <DetailModal
        item={selectedDetailItem}
        isOpen={Boolean(selectedDetailItem)}
        onClose={() => setSelectedDetailItem(null)}
        userType={viewerRole === "individual" ? "learner" : "coach"}
        isLoggedIn={Boolean(viewerUserId)}
        userId={viewerUserId}
        userName={viewerName}
        userRole={viewerRole ?? undefined}
        tenantId={tenantId}
      />
    </main>
  );
}
