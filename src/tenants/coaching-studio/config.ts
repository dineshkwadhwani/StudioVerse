import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "coaching-studio",
  name: "Coaching Studio",
  domain: "coaching-studio.com",
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
  botConfig: {
    visible: true,
    studioBotEnabled: true,
    professionalBotEnabled: true,
    personaName: "Coach Dinesh",
    personaAvatar: "/tenants/coaching-studio/bot.png",
    messageCap: 5,
  },
  landingContent: {
    sections: {
      programs: true,
      tools: true,
      events: true,
    },
    carouselItemLimits: {
      programs: 8,
      tools: 8,
      events: 8,
    },
    displayLabels: {
      tools: "Assessment Centre",
    },
    heroImages: {
      programs: "/tenants/coaching-studio/hero1.png",
      tools: "/tenants/coaching-studio/hero2.png",
      events: "/tenants/coaching-studio/hero3.png",
    },
  },
};