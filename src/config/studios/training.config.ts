// src/config/studios/training.config.ts
export const trainingConfig = {
  id: 'training-studio',
  name: 'Training Studio',
  domain: 'trainingstudio.com',
  roles: {
    superAdmin: 'Super Admin',
    company: 'Training Company',
    professional: 'Trainer',
    individual: 'Learner',
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
    primaryColor: '#2563eb',
    logo: '/studios/training-studio/logo.png',
  },
}