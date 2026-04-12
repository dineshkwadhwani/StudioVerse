import { TenantConfig } from "@/types/tenant";

export const config: TenantConfig = {
  id: "recruitment-studio",
  name: "Recruitment Studio",
  domain: "recruitment-studio.com",
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
    logo: "/tenants/recruitment-studio/logo.svg",
  },
};