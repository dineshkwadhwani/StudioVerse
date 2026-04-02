export type TenantConfig = {
  id: string;
  name: string;
  domain: string;
  roles: {
    superAdmin: string;
    company: string;
    professional: string;
    individual: string;
  };
  labels: {
    program: string;
    session: string;
    assessment: string;
  };
  features: {
    assessments: boolean;
    events: boolean;
    aiCoach: boolean;
  };
  theme: {
    primaryColor: string;
    logo: string;
  };
  landingContent?: {
    programs: LandingContentItem[];
    tools: LandingContentItem[];
    events: LandingContentItem[];
  };
};

export type LandingContentItem = {
  name: string;
  image: string;
  title: string;
  description: string;
};