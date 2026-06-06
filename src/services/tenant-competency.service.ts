import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { listCompetencies } from "@/services/competencies.service";
import {
  COMPETENCY_LEVEL_VALUES,
  type CompetencyLevelOption,
  type CompetencyLevelValue,
  type TenantCompetencyFrameworkSelection,
} from "@/types/competency";

type TenantCompetencyDoc = {
  competencyFramework?: {
    competencyId?: unknown;
    competencyName?: unknown;
  };
};

export type TenantCompetencyFrameworkDetails = {
  framework: TenantCompetencyFrameworkSelection | null;
  options: CompetencyLevelOption[];
};

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCompetencyLevel(value: unknown): CompetencyLevelValue {
  const numeric = Number(value);
  return COMPETENCY_LEVEL_VALUES.includes(numeric as CompetencyLevelValue)
    ? (numeric as CompetencyLevelValue)
    : 1;
}

function buildGenericLevelOptions(): CompetencyLevelOption[] {
  return COMPETENCY_LEVEL_VALUES.map((value) => ({
    value,
    label: `Level ${value}`,
    description: `Competency level ${value}`,
  }));
}

export async function listCompetencyFrameworksForTenant(tenantId: string) {
  return listCompetencies(tenantId);
}

export async function getTenantCompetencyFrameworkDetails(tenantId: string): Promise<TenantCompetencyFrameworkDetails> {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    return {
      framework: null,
      options: buildGenericLevelOptions(),
    };
  }

  const [tenantSnap, competencies] = await Promise.all([
    getDoc(doc(db, "tenants", normalizedTenantId)),
    listCompetencies(normalizedTenantId),
  ]);

  const tenantData = tenantSnap.data() as TenantCompetencyDoc | undefined;
  const competencyId = toTrimmedString(tenantData?.competencyFramework?.competencyId);
  const competencyName = toTrimmedString(tenantData?.competencyFramework?.competencyName);
  const matched = competencies.find((item) => item.id === competencyId);

  if (!matched) {
    return {
      framework: competencyId
        ? {
            competencyId,
            competencyName: competencyName || competencyId,
          }
        : null,
      options: buildGenericLevelOptions(),
    };
  }

  return {
    framework: {
      competencyId: matched.id,
      competencyName: matched.name,
    },
    options: matched.levels
      .map((level) => ({
        value: normalizeCompetencyLevel(level.level),
        label: level.label || `Level ${normalizeCompetencyLevel(level.level)}`,
        description: level.description,
        scoreLevel: level.scoreLevel,
      }))
      .sort((left, right) => left.value - right.value),
  };
}