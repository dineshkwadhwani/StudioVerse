import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import type { CompetencyRecord, CompetencyLevelRecord } from "@/types/competency";

export interface SeedCompetenciesResult {
  added: number;
  skipped: number;
  total: number;
}

interface SeedCompetenciesParams {
  tenantId: string;
}

type CompetencyDocData = {
  tenantId?: unknown;
  name?: unknown;
  sortOrder?: unknown;
  levels?: unknown;
};

type CompetencyLevelData = {
  level?: unknown;
  label?: unknown;
  description?: unknown;
  scoreLevel?: unknown;
};

const seedCompetenciesCallable = httpsCallable<SeedCompetenciesParams, SeedCompetenciesResult>(
  functions,
  "seedCompetencies",
);

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapLevels(raw: unknown): CompetencyLevelRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const levelData = item as CompetencyLevelData;
    return {
      level: Number(levelData.level ?? 0),
      label: toTrimmedString(levelData.label),
      description: toTrimmedString(levelData.description),
      scoreLevel: toTrimmedString(levelData.scoreLevel) || undefined,
    };
  });
}

export async function listCompetencies(tenantId: string): Promise<CompetencyRecord[]> {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    return [];
  }

  const snapshot = await getDocs(
    query(collection(db, "competency"), where("tenantId", "==", normalizedTenantId)),
  );

  return snapshot.docs
    .map((row) => {
      const data = row.data() as CompetencyDocData;
      return {
        id: row.id,
        tenantId: toTrimmedString(data.tenantId),
        name: toTrimmedString(data.name),
        sortOrder: Number(data.sortOrder ?? 0),
        levels: mapLevels(data.levels),
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export async function seedCompetencies(tenantId: string): Promise<SeedCompetenciesResult> {
  const result = await seedCompetenciesCallable({ tenantId });
  return result.data;
}