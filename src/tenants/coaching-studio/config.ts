import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "coaching-studio",
  name: "Coaching Studio",
  domain: "coachingstudio.com",
  roles: {
    superAdmin: "Super Admin",
    company: "Coaching Company",
    professional: "Coach",
    individual: "Coachee",
  },
  labels: {
    program: "Program",
    session: "Session",
    assessment: "Assessment",
  },
  features: {
    assessments: true,
    events: true,
    aiCoach: true,
  },
  theme: {
    primaryColor: "#01696f",
    logo: "/tenants/coaching-studio/logo.png",
  },
  landingContent: {
    programs: [
      {
        name: "executive_communication_presence",
        image: "/tenants/coaching-studio/programs/executive_communication_presence.png",
        title: "Executive Communication & Presence",
        description: "Communicate with authority and influence high-stakes decisions with confidence.",
      },
      {
        name: "strategic_thinking_decision_mastery",
        image: "/tenants/coaching-studio/programs/strategic_thinking_decision_mastery.png",
        title: "Strategic Thinking & Decision Mastery",
        description: "Think beyond the obvious and lead data-driven decisions with foresight.",
      },
      {
        name: "first_time_manager_accelerator",
        image: "/tenants/coaching-studio/programs/first_time_manager_accelerator.png",
        title: "First-Time Manager Accelerator",
        description: "Transition into leadership quickly with the right mindset and tools.",
      },
      {
        name: "stakeholder_management",
        image: "/tenants/coaching-studio/programs/stakeholder_management.png",
        title: "Stakeholder management only",
        description: "Influence complex stakeholders, align priorities, and drive executive outcomes.",
      },
      {
        name: "performance_coaching_leaders",
        image: "/tenants/coaching-studio/programs/performance_coaching_leaders.png",
        title: "Performance Coaching for Leaders",
        description: "Drive accountability and performance through structured coaching conversations.",
      },
      {
        name: "high_impact_team_leadership",
        image: "/tenants/coaching-studio/programs/high_impact_team_leadership.png",
        title: "High-Impact Team Leadership",
        description: "Build cohesive teams that collaborate, execute, and deliver consistently.",
      },
      {
        name: "women_leadership_rise_lead",
        image: "/tenants/coaching-studio/programs/women_leadership_rise_lead.png",
        title: "Women in Leadership - Rise & Lead",
        description: "Build executive presence and leadership impact with confidence and clarity.",
      },
      {
        name: "negotiation_influence_skills",
        image: "/tenants/coaching-studio/programs/negotiation_influence_skills.png",
        title: "Negotiation & Influence Skills",
        description: "Negotiate win-win outcomes, handle conflict, and close with confidence.",
      },
    ],
    tools: [
      {
        name: "coaching_impact_analytics",
        image: "/tenants/coaching-studio/tools/coaching_impact_analytics.png",
        title: "Coaching Impact Analytics",
        description: "Turn coaching into measurable business outcomes with real-time ROI insights.",
      },
      {
        name: "goal_alignment_okr_tracker",
        image: "/tenants/coaching-studio/tools/goal_alignment_okr_tracker.png",
        title: "Goal Alignment & OKR Tracker",
        description: "Align goals to business priorities and drive accountable execution at scale.",
      },
      {
        name: "leadership_insight_engine",
        image: "/tenants/coaching-studio/tools/leadership_insight_engine.png",
        title: "Leadership Insight Engine",
        description: "Reveal leadership strengths and blind spots with personalized intelligence.",
      },
      {
        name: "performance_acceleration_dashboard",
        image: "/tenants/coaching-studio/tools/performance_acceleration_dashboard.png",
        title: "Performance Acceleration Dashboard",
        description: "Spot performance trends early and act on data-backed opportunities fast.",
      },
      {
        name: "stakeholder_influence_mapper",
        image: "/tenants/coaching-studio/tools/stakeholder_influence_mapper.png",
        title: "Stakeholder Influence Mapper",
        description: "Map influence dynamics and alignment gaps across critical stakeholders.",
      },
      {
        name: "continuous_feedback_loop",
        image: "/tenants/coaching-studio/tools/continuous_feedback_loop.png",
        title: "Continuous Feedback Loop",
        description: "Capture ongoing feedback to power continuous improvement and growth.",
      },
      {
        name: "team_alignment_health_scanner",
        image: "/tenants/coaching-studio/tools/team_alignment_health_scanner.png",
        title: "Team Alignment & Health Scanner",
        description: "Assess trust, cohesion, and execution in one unified team health view.",
      },
      {
        name: "growth_journey_planner",
        image: "/tenants/coaching-studio/tools/growth_journey_planner.png",
        title: "Growth Journey Planner",
        description: "Design milestone-led journeys that sustain measurable leadership transformation.",
      },
    ],
    events: [
      {
        name: "manager_excellence_webinar",
        image: "/tenants/coaching-studio/events/manager_excellence_webinar.png",
        title: "Manager Excellence Webinar",
        description: "Practical guidance for managers leading teams through change and growth.",
      },
      {
        name: "chro_roundtable",
        image: "/tenants/coaching-studio/events/chro_roundtable.png",
        title: "CHRO Roundtable",
        description: "Private peer exchange on leadership capability and talent priorities.",
      },
      {
        name: "women_leaders_breakfast",
        image: "/tenants/coaching-studio/events/women_leaders_breakfast.png",
        title: "Women Leaders Breakfast",
        description: "Connect women leaders through curated dialogue and shared learning.",
      },
      {
        name: "coaching_demo_day",
        image: "/tenants/coaching-studio/events/coaching_demo_day.png",
        title: "Coaching Demo Day",
        description: "Experience live programme and tool walkthroughs before you commit.",
      },
      {
        name: "executive_presentation_showcase",
        image: "/tenants/coaching-studio/events/executive_presentation_showcase.png",
        title: "Executive Presentation Showcase",
        description:
          "Sharpen your presentation skills on a high-impact stage and learn to communicate with confidence to influential stakeholders.",
      },
      {
        name: "executive_networking_circle",
        image: "/tenants/coaching-studio/events/executive_networking_circle.png",
        title: "Executive Networking Circle",
        description: "Bring leaders together for trusted introductions and strategic conversations.",
      },
      {
        name: "growth_strategy_townhall",
        image: "/tenants/coaching-studio/events/growth_strategy_townhall.png",
        title: "Growth Strategy Townhall",
        description: "Align teams around priorities, execution, and measurable growth goals.",
      },
    ],
  },
};