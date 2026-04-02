// src/config/studio.config.ts

import { coachingConfig } from './studios/coaching.config'
import { trainingConfig } from './studios/training.config'
import { recruitmentConfig } from './studios/recruitment.config'

export type StudioType = 'coaching' | 'training' | 'recruitment'

const studioConfigMap = {
  coaching: coachingConfig,
  training: trainingConfig,
  recruitment: recruitmentConfig,
} as const

export function getStudioConfig(studioType?: StudioType) {
  const activeStudio =
    studioType ||
    (process.env.NEXT_PUBLIC_STUDIO_TYPE as StudioType | undefined) ||
    'coaching'

  return studioConfigMap[activeStudio]
}

export const studioConfig = getStudioConfig()