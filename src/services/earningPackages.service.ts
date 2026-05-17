import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import type { EarningPackagesRecord } from "@/types/earningPackages";

export interface SeedEarningPackagesResult {
  status: "seeded" | "already-exists";
  creditPackages: number;
  listingPackages: number;
  promotionPackages: number;
  botPackages: number;
  leadPackages: number;
  leadFees: number;
  message: string;
}



interface SeedEarningPackagesParams {
  tenantId: string;
  seedType: "creditPackages" | "promotionPackages" | "listingPackages" | "botPackages" | "leadPackages";
}
interface SeedSingleTypeParams {
  tenantId: string;
}

const seedEarningPackagesCallable = httpsCallable<SeedEarningPackagesParams, SeedEarningPackagesResult>(
  functions,
  "seedEarningPackages",
);
const seedCreditPackagesCallable = httpsCallable<SeedSingleTypeParams, SeedEarningPackagesResult>(
  functions,
  "seedCreditPackages",
);
const seedPromotionPackagesCallable = httpsCallable<SeedSingleTypeParams, SeedEarningPackagesResult>(
  functions,
  "seedPromotionPackages",
);
const seedListingPackagesCallable = httpsCallable<SeedSingleTypeParams, SeedEarningPackagesResult>(
  functions,
  "seedListingPackages",
);
const seedBotPackagesCallable = httpsCallable<SeedSingleTypeParams, SeedEarningPackagesResult>(
  functions,
  "seedBotPackages",
);
const seedLeadPackagesCallable = httpsCallable<SeedSingleTypeParams, SeedEarningPackagesResult>(
  functions,
  "seedLeadPackages",
);

async function callSeedWithFallback(
  tenantId: string,
  seedType: SeedEarningPackagesParams["seedType"],
  singleTypeCallable: (payload: SeedSingleTypeParams) => Promise<{ data: SeedEarningPackagesResult }>,
): Promise<SeedEarningPackagesResult> {
  try {
    const result = await singleTypeCallable({ tenantId });
    return result.data;
  } catch {
    const result = await seedEarningPackagesCallable({ tenantId, seedType });
    return result.data;
  }
}

export async function seedCreditPackages(tenantId: string): Promise<SeedEarningPackagesResult> {
  return callSeedWithFallback(tenantId, "creditPackages", seedCreditPackagesCallable);
}

export async function seedPromotionPackages(tenantId: string): Promise<SeedEarningPackagesResult> {
  return callSeedWithFallback(tenantId, "promotionPackages", seedPromotionPackagesCallable);
}

export async function seedListingPackages(tenantId: string): Promise<SeedEarningPackagesResult> {
  return callSeedWithFallback(tenantId, "listingPackages", seedListingPackagesCallable);
}

export async function seedBotPackages(tenantId: string): Promise<SeedEarningPackagesResult> {
  return callSeedWithFallback(tenantId, "botPackages", seedBotPackagesCallable);
}

export async function seedLeadPackages(tenantId: string): Promise<SeedEarningPackagesResult> {
  return callSeedWithFallback(tenantId, "leadPackages", seedLeadPackagesCallable);
}

export async function getEarningPackages(tenantId: string): Promise<EarningPackagesRecord | null> {
  try {
    const snapshot = await getDocs(collection(db, "earningPackages"));
    const doc = snapshot.docs.find((d) => d.id === tenantId);
    if (!doc) {
      return null;
    }
    const data = doc.data() as Record<string, unknown>;
    return {
      tenantId,
      creditPackages: Array.isArray(data.creditPackages) ? data.creditPackages : [],
      listingPackages: Array.isArray(data.listingPackages) ? data.listingPackages : [],
      botPackages: Array.isArray(data.botPackages) ? data.botPackages : [],
      promotionPackages: Array.isArray(data.promotionPackages) ? data.promotionPackages : [],
      leadPackages: Array.isArray(data.leadPackages) ? data.leadPackages : [],
      leadFees: Array.isArray(data.leadFees) ? data.leadFees : [],
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    } satisfies EarningPackagesRecord;
  } catch {
    return null;
  }
}
