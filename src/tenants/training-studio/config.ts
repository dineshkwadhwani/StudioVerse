import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "training-studio",
  name: "Training Studio",
  domain: "training-studio.in",
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
    logo: "/tenants/training-studio/logo.svg",
  },
};