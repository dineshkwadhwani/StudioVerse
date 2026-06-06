export type TenantConfig = {
  id: string;
  name: string;
  domain: string;
  platform: {
    name: string;
  };
  branding?: {
    appDisplayName?: string;
    appSubtitle?: string;
    faviconPath?: string;
    contactEmail?: string;
  };
  pageMeta?: {
    defaultTitle?: string;
    defaultDescription?: string;
  };
  legal?: {
    privacyPolicyPath?: string;
    termsPath?: string;
  };
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
  searchConfig?: {
    enabled: boolean;
    programs: boolean;
    assessments: boolean;
    events: boolean;
    professional: boolean;
    individual: boolean;
    company: boolean;
  };
  developmentConfig?: {
    enabled: boolean;
    freePlans: number;
    costPerPlanCredits: number;
  };
  botConfig?: {
    visible: boolean;
    studioBotEnabled: boolean;
    professionalBotEnabled: boolean;
    personaName: string;
    personaAvatar?: string;
    messageCap: number;
  };
  mailConfig?: {
    enabled: boolean;
    fromEmail: string;
    fromName: string;
  };
  mailTemplates?: {
    assignmentNotification?: {
      subject: string;
      body: string;
    };
    invitationNotification?: {
      subject: string;
      body: string;
    };
  };
  theme: {
    primaryColor: string;
    logo: string;
  };
  landingContent?: {
    sections?: {
      programs: boolean;
      tools: boolean;
      events: boolean;
    };
    carouselItemLimits?: {
      programs?: number;
      tools?: number;
      events?: number;
    };
    displayLabels?: {
      programs?: string;
      tools?: string;
      events?: string;
    };
    heroImages?: {
      programs: string;
      tools: string;
      events: string;
    };
    programs?: LandingContentItem[];
    tools?: LandingContentItem[];
    events?: LandingContentItem[];
  };
};

export type LandingContentItem = {
  name: string;
  image: string;
  title: string;
  description: string;
};