import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import type { EarningPackagesRecord } from "@/types/earningPackages";

export interface SeedEarningPackagesResult {
  status: "seeded" | "already-exists";
  creditPackages: number;
  listingPackages: number;
  botPackages: number;
  leadFees: number;
  message: string;
}

const seedEarningPackagesCallable = httpsCallable<Record<string, never>, SeedEarningPackagesResult>(functions, "seedEarningPackages");

export async function seedEarningPackages(): Promise<SeedEarningPackagesResult> {
  const result = await seedEarningPackagesCallable({});
  return result.data;
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
      leadFees: Array.isArray(data.leadFees) ? data.leadFees : [],
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    } satisfies EarningPackagesRecord;
  } catch {
    return null;
  }
}
