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
};