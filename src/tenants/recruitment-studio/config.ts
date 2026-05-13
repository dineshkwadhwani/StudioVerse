import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "recruitment-studio",
  name: "Recruitment Studio",
  domain: "recruitment-studio.com",
  platform: {
    name: "StudioVerse",
  },
  branding: {
    appDisplayName: "Recruitment Studio",
    appSubtitle: "StudioVerse Platform",
    faviconPath: "/tenants/recruitment-studio/logo.png",
  },
  pageMeta: {
    defaultTitle: "Recruitment Studio",
    defaultDescription: "Recruitment Studio powered by StudioVerse.",
  },
  roles: {
    superAdmin: "Super Admin",
    company: "Recruitment Agency",
    professional: "Recruiter",
    individual: "Candidate",
  },
  labels: {
    program: "Job Track",
    session: "Interview",
    assessment: "Screening",
  },
  features: {
    assessments: true,
    events: false,
    aiCoach: false,
  },
  theme: {
    primaryColor: "#7e3af2",
    logo: "/tenants/recruitment-studio/logo.png",
  },
  landingContent: {
    heroImages: {
      programs: "/tenants/recruitment-studio/hero1.png",
      tools: "/tenants/recruitment-studio/hero2.png",
      events: "/tenants/recruitment-studio/hero3.png",
    },
  },
};