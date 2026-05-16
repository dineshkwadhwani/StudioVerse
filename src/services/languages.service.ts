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

const seedLanguagesCallable = httpsCallable<Record<string, never>, SeedLanguagesResult>(functions, "seedLanguages");

export async function listLanguages(): Promise<LanguageRecord[]> {
  const doc = await getDocs(collection(db, "languages"));
  
  const itemsDoc = doc.docs.find((d) => d.id === "items");
  if (!itemsDoc) {
    return [];
  }

  const data = itemsDoc.data() as { items?: Array<{code: string; name: string}> } | undefined;
  const items = data?.items ?? [];

  return items.map((item, idx) => ({
    id: item.code,
    name: item.name,
    code: item.code,
  }));
}

export async function seedLanguages(): Promise<SeedLanguagesResult> {
  const result = await seedLanguagesCallable({});
  return result.data;
}
