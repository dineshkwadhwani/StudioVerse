// src/config/studios/coaching.config.ts
export const coachingConfig = {
  id: 'coaching-studio',
  name: 'Coaching Studio',
  domain: 'coachingstudio.com',
  roles: {
    superAdmin: 'Super Admin',
    company: 'Coaching Company',
    professional: 'Coach',
    individual: 'Coachee',
  },
  labels: {
    program: 'Program',
    session: 'Session',
    assessment: 'Assessment',
  },
  features: {
    assessments: true,
    events: true,
    aiCoach: true,
  },
  theme: {
    primaryColor: '#01696f',
    logo: '/studios/coaching-studio/logo.png',
  },
}