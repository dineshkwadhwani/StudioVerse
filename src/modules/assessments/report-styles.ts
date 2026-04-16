import type { AssessmentReportStyle } from "@/types/assessment";

export type ReportSectionTone = "positive" | "warning" | "neutral" | "action";

export type ReportSectionDefinition = {
  key: string;
  title: string;
  description: string;
  tone: ReportSectionTone;
};

export const DEFAULT_REPORT_STYLE: AssessmentReportStyle = "development-template";

export const REPORT_STYLE_LABELS: Record<AssessmentReportStyle, string> = {
  "development-template": "Development Template",
  "diagnostic-template": "Diagnostic Template",
  "capability-scorecard-template": "Capability Scorecard Template",
  "leadership-readiness-template": "Leadership Readiness Template",
  "behavioral-pattern-template": "Behavioral Pattern Template",
  "360-influence-template": "360 Influence Template",
  "growth-journey-template": "Growth Journey Template",
  "executive-coaching-premium-template": "Executive Coaching Premium Template",
  "action-centric-template": "Action-Centric Template",
  "psychological-insight-template": "Psychological Insight Template",
};

export const REPORT_STYLE_SECTIONS: Record<AssessmentReportStyle, ReportSectionDefinition[]> = {
  "development-template": [
    { key: "strengths", title: "Strengths", description: "Core strengths and capabilities to build on.", tone: "positive" },
    { key: "blind-spots", title: "Blind Spots", description: "Patterns, gaps, or risks holding this person back.", tone: "warning" },
    { key: "recommendations", title: "Recommendations", description: "Practical development guidance.", tone: "neutral" },
    { key: "next-actions", title: "Next Actions", description: "Immediate actions to take next.", tone: "action" },
  ],
  "diagnostic-template": [
    { key: "dominant-patterns", title: "Dominant Patterns", description: "Observed recurring strengths or productive tendencies.", tone: "positive" },
    { key: "counterproductive-patterns", title: "Counterproductive Patterns", description: "Behaviors that reduce effectiveness.", tone: "warning" },
    { key: "growth-focus-areas", title: "Growth Focus Areas", description: "High-leverage themes to improve.", tone: "neutral" },
    { key: "immediate-practices", title: "Immediate Practices", description: "Specific practices to start right away.", tone: "action" },
  ],
  "capability-scorecard-template": [
    { key: "strongest-dimensions", title: "Strongest Dimensions", description: "Capabilities performing at the highest level.", tone: "positive" },
    { key: "lowest-capability-areas", title: "Lowest Capability Areas", description: "Areas limiting overall capability.", tone: "warning" },
    { key: "development-priorities", title: "Development Priorities", description: "Priority capability improvements.", tone: "neutral" },
    { key: "thirty-day-direction", title: "30-Day Direction", description: "Short-term action direction for the next month.", tone: "action" },
  ],
  "leadership-readiness-template": [
    { key: "seniority-signals", title: "Seniority Signals", description: "Behaviors showing readiness for larger scope.", tone: "positive" },
    { key: "derailers", title: "Derailers", description: "Patterns that can block progression to the next level.", tone: "warning" },
    { key: "strengthening-priorities", title: "Strengthening Priorities", description: "Capabilities that must improve for larger scope.", tone: "neutral" },
    { key: "next-level-behaviors", title: "Next-Level Behaviors", description: "Specific behaviors expected at the next level.", tone: "action" },
  ],
  "behavioral-pattern-template": [
    { key: "strength-zones", title: "Strength Zones", description: "Situations where the participant tends to perform best.", tone: "positive" },
    { key: "typical-biases", title: "Typical Biases", description: "Repeated assumptions or distortions shaping choices.", tone: "warning" },
    { key: "under-pressure-behavior", title: "Under-Pressure Behavior", description: "What tends to show up under stress.", tone: "neutral" },
    { key: "corrective-habits", title: "Corrective Habits", description: "Specific habits that can rebalance behavior.", tone: "action" },
  ],
  "360-influence-template": [
    { key: "trust-signals", title: "Trust Signals", description: "Behaviors that help others trust and follow this person.", tone: "positive" },
    { key: "friction-signals", title: "Friction Signals", description: "Behaviors likely to create friction for others.", tone: "warning" },
    { key: "influence-strengths", title: "Influence Strengths", description: "Strengths that increase influence and credibility.", tone: "neutral" },
    { key: "reputation-actions", title: "Reputation Actions", description: "Specific moves to improve how others experience them.", tone: "action" },
  ],
  "growth-journey-template": [
    { key: "current-gains", title: "Current Gains", description: "Progress signals and strengths visible in the current snapshot.", tone: "positive" },
    { key: "remaining-gaps", title: "Remaining Gaps", description: "Development gaps still limiting progress.", tone: "warning" },
    { key: "next-phase-focus", title: "Next-Phase Focus", description: "Themes that matter most in the next stage of growth.", tone: "neutral" },
    { key: "immediate-practices", title: "Immediate Practices", description: "Practices to start now to continue growth.", tone: "action" },
  ],
  "executive-coaching-premium-template": [
    { key: "strengths-to-leverage", title: "Strengths to Leverage", description: "Executive-level strengths to amplify.", tone: "positive" },
    { key: "limiting-behaviors", title: "Limiting Behaviors", description: "Behaviors that reduce scale, leverage, or executive presence.", tone: "warning" },
    { key: "reputation-signals", title: "Reputation Signals", description: "How leadership reputation is likely being shaped.", tone: "neutral" },
    { key: "promotion-requirements", title: "Promotion Requirements", description: "What must strengthen for broader scale or promotion.", tone: "neutral" },
    { key: "growth-direction", title: "30/90 Day Growth Direction", description: "Concrete near-term and medium-term direction.", tone: "action" },
  ],
  "action-centric-template": [
    { key: "continue-doing", title: "Continue Doing", description: "Behaviors worth preserving and reinforcing.", tone: "positive" },
    { key: "stop-doing", title: "Stop Doing", description: "Behaviors to reduce or eliminate.", tone: "warning" },
    { key: "start-doing", title: "Start Doing", description: "New behaviors to begin using.", tone: "neutral" },
    { key: "this-week-actions", title: "This Week", description: "Actions to execute this week.", tone: "action" },
    { key: "this-month-actions", title: "This Month", description: "Actions to execute over this month.", tone: "action" },
  ],
  "psychological-insight-template": [
    { key: "adaptive-tendencies", title: "Adaptive Tendencies", description: "Constructive tendencies and productive defaults.", tone: "positive" },
    { key: "stress-reactions", title: "Stress Reactions", description: "Patterns that surface under pressure or uncertainty.", tone: "warning" },
    { key: "relationship-patterns", title: "Relationship Patterns", description: "How the participant tends to affect relationships.", tone: "neutral" },
    { key: "growth-levers", title: "Growth Levers", description: "Core levers that can unlock change.", tone: "neutral" },
    { key: "interpersonal-shifts", title: "Interpersonal Shifts", description: "Specific shifts to improve interpersonal effectiveness.", tone: "action" },
  ],
};

const REPORT_STYLE_INSTRUCTIONS: Record<AssessmentReportStyle, string[]> = {
  "development-template": [
    "Return a balanced coaching-style report.",
    "Keep recommendations practical and next actions immediately actionable.",
  ],
  "diagnostic-template": [
    "Keep the tone diagnostic, specific, and behavior-based.",
    "Differentiate productive patterns from counterproductive ones.",
  ],
  "capability-scorecard-template": [
    "Frame the report like a premium capability review.",
    "Use precise, capability-oriented language rather than generic coaching language.",
  ],
  "leadership-readiness-template": [
    "Focus on readiness for larger scope and signs of seniority.",
    "Be explicit about what must strengthen for the next level.",
  ],
  "behavioral-pattern-template": [
    "Analyze decision style and repeated behavioral tendencies.",
    "Make pressure behavior concrete rather than abstract.",
  ],
  "360-influence-template": [
    "Write as if describing how other people are likely to experience this person.",
    "Keep the framing grounded in reputation and interpersonal impact.",
  ],
  "growth-journey-template": [
    "Write as a progress-oriented coaching snapshot.",
    "Acknowledge current gains before remaining gaps.",
  ],
  "executive-coaching-premium-template": [
    "Use executive-level language focused on scale, reputation, and promotion readiness.",
    "Keep the guidance premium, concise, and commercially credible.",
  ],
  "action-centric-template": [
    "Keep every point crisp and execution-focused.",
    "Prefer direct action language over analysis-heavy wording.",
  ],
  "psychological-insight-template": [
    "Focus on motivations, stress responses, and relationship effects.",
    "Keep it insightful without sounding clinical or overly diagnostic.",
  ],
};

function buildReportStylePrompt(style: AssessmentReportStyle): string {
  const sections = REPORT_STYLE_SECTIONS[style];
  const schema = JSON.stringify(
    {
      summary: "string",
      sections: sections.map((section) => ({
        key: section.key,
        title: section.title,
        items: ["string"],
      })),
    },
    null,
    2
  );

  return [
    `Use the ${REPORT_STYLE_LABELS[style]}.`,
    ...REPORT_STYLE_INSTRUCTIONS[style],
    `Return valid JSON using this exact structure and these exact section keys/titles:\n${schema}`,
    `Use exactly ${sections.length} sections in this order: ${sections.map((section) => `${section.title} [${section.key}]`).join(", ")}.`,
    "Each section must contain 3 to 5 concise bullet-style items.",
    "Do not invent extra top-level keys. Do not use the generic strengths/blindSpots/recommendations/nextActions schema unless those exact keys are required by this selected style.",
  ].join(" ");
}

export const REPORT_STYLE_PROMPTS: Record<AssessmentReportStyle, string> = {
  "development-template": buildReportStylePrompt("development-template"),
  "diagnostic-template": buildReportStylePrompt("diagnostic-template"),
  "capability-scorecard-template": buildReportStylePrompt("capability-scorecard-template"),
  "leadership-readiness-template": buildReportStylePrompt("leadership-readiness-template"),
  "behavioral-pattern-template": buildReportStylePrompt("behavioral-pattern-template"),
  "360-influence-template": buildReportStylePrompt("360-influence-template"),
  "growth-journey-template": buildReportStylePrompt("growth-journey-template"),
  "executive-coaching-premium-template": buildReportStylePrompt("executive-coaching-premium-template"),
  "action-centric-template": buildReportStylePrompt("action-centric-template"),
  "psychological-insight-template": buildReportStylePrompt("psychological-insight-template"),
};
