import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";

export interface LanguageRecord {
  id: string;
  name: string;
  code: string;
}

export interface SeedLanguagesResult {
  added: number;
  skipped: number;
  total: number;
}


interface SeedLanguagesParams {
  tenantId: string;
}
const seedLanguagesCallable = httpsCallable<SeedLanguagesParams, SeedLanguagesResult>(functions, "seedLanguages");

type LanguageItem = { code: string; name: string };

function mapLanguageItems(items: LanguageItem[]): LanguageRecord[] {
  return items.map((item) => ({
    id: item.code,
    name: item.name,
    code: item.code,
  }));
}

export async function listLanguages(tenantId?: string): Promise<LanguageRecord[]> {
  const snapshot = await getDocs(collection(db, "languages"));
  const normalizedTenantId = tenantId?.trim() ?? "";

  if (normalizedTenantId) {
    const tenantDoc = snapshot.docs.find((doc) => doc.id === normalizedTenantId);
    if (tenantDoc) {
      const data = tenantDoc.data() as { items?: LanguageItem[] } | undefined;
      return mapLanguageItems(data?.items ?? []);
    }
  }

  const itemsDoc = snapshot.docs.find((doc) => doc.id === "items");
  if (itemsDoc) {
    const data = itemsDoc.data() as { items?: LanguageItem[] } | undefined;
    return mapLanguageItems(data?.items ?? []);
  }

  const deduped = new Map<string, LanguageRecord>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as { items?: LanguageItem[] } | undefined;
    (data?.items ?? []).forEach((item) => {
      if (!deduped.has(item.code)) {
        deduped.set(item.code, {
          id: item.code,
          name: item.name,
          code: item.code,
        });
      }
    });
  });

  return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function seedLanguages(tenantId: string): Promise<SeedLanguagesResult> {
  const result = await seedLanguagesCallable({ tenantId });
  return result.data;
}
