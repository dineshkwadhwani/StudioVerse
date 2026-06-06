export interface CompetencyLevelRecord {
  level: number;
  label: string;
  description: string;
  scoreLevel?: string;
}

export const COMPETENCY_LEVEL_VALUES = [1, 2, 3, 4, 5] as const;

export type CompetencyLevelValue = (typeof COMPETENCY_LEVEL_VALUES)[number];

export interface TenantCompetencyFrameworkSelection {
  competencyId: string;
  competencyName: string;
}

export interface CompetencyLevelOption {
  value: CompetencyLevelValue;
  label: string;
  description: string;
  scoreLevel?: string;
}

export interface CompetencyRecord {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  levels: CompetencyLevelRecord[];
}