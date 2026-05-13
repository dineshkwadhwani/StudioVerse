import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "training-studio",
  name: "Training Studio",
  domain: "training-studio.in",
  platform: {
    name: "StudioVerse",
  },
  branding: {
    appDisplayName: "Training Studio",
    appSubtitle: "StudioVerse Platform",
    faviconPath: "/tenants/training-studio/logo.png",
  },
  pageMeta: {
    defaultTitle: "Training Studio",
    defaultDescription: "Training Studio powered by StudioVerse.",
  },
  roles: {
    superAdmin: "Super Admin",
    company: "Training Company",
    professional: "Trainer",
    individual: "Learner",
  },
  labels: {
    program: "Program",
    session: "Session",
    assessment: "Assessment",
  },
  features: {
    assessments: true,
    events: true,
    aiCoach: false,
  },
  theme: {
    primaryColor: "#1a56db",
    logo: "/tenants/training-studio/logo.png",
  },
  landingContent: {
    heroImages: {
      programs: "/tenants/training-studio/hero1.png",
      tools: "/tenants/training-studio/hero2.png",
      events: "/tenants/training-studio/hero3.png",
    },
  },
};