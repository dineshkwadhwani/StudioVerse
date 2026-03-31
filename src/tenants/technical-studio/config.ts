import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "technical-studio",
  name: "Technical Studio",
  domain: "technicalstudio.com",
  roles: {
    superAdmin: "Super Admin",
    company: "Training Company",
    professional: "Trainer",
    individual: "Learner",
  },
  labels: {
    program: "Course",
    session: "Class",
    assessment: "Test",
  },
  features: {
    assessments: true,
    events: true,
    aiCoach: false,
  },
  theme: {
    primaryColor: "#1a56db",
    logo: "/tenants/technical-studio/logo.svg",
  },
};