// src/config/studios/recruitment.config.ts
export const recruitmentConfig = {
  id: 'recruitment-studio',
  name: 'Recruitment Studio',
  domain: 'recruitment-studio.com',
  roles: {
    superAdmin: 'Super Admin',
    company: 'Recruitment Agency',
    professional: 'Recruiter',
    individual: 'Candidate',
  },
  labels: {
    program: 'Program',
    session: 'Session',
    assessment: 'Assessment',
  },
  features: {
    assessments: true,
    events: true,
    aiCoach: false,
  },
  theme: {
    primaryColor: '#7c3aed',
    logo: '/studios/recruitment-studio/logo.png',
  },
}