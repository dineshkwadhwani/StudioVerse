import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/services/firebase";
import type { CategoryRecord, SubCategoryRecord, TopicRecord, CategoryRecordNested } from "@/types/category";

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type SeedTaxonomyResult = {
  status: "seeded" | "already-exists";
  categories: number;
  subCategories: number;
  topics: number;
  message: string;
};

const seedTaxonomyCallable = httpsCallable<Record<string, never>, SeedTaxonomyResult>(
  functions,
  "seedTaxonomyFromXlsx",
);

export async function seedTaxonomyFromXlsx(): Promise<SeedTaxonomyResult> {
  const result = await seedTaxonomyCallable({});
  return result.data;
}

/**
 * Flatten nested category structure into separate arrays for backward compatibility
 */
function flattenCategories(nested: CategoryRecordNested[]): {
  categories: CategoryRecord[];
  subCategories: SubCategoryRecord[];
  topics: TopicRecord[];
} {
  const categories: CategoryRecord[] = [];
  const subCategories: SubCategoryRecord[] = [];
  const topics: TopicRecord[] = [];

  for (const cat of nested) {
    categories.push({
      id: cat.id,
      tenantId: cat.tenantId,
      tenantName: cat.tenantName,
      name: cat.name,
      description: cat.description,
      createdBy: cat.createdBy,
      updatedBy: cat.updatedBy,
    });

    for (const subCat of cat.subCategories) {
      subCategories.push({
        id: subCat.id,
        tenantId: cat.tenantId,
        tenantName: cat.tenantName,
        categoryId: cat.id,
        categoryName: cat.name,
        name: subCat.name,
        description: subCat.description || "",
        createdBy: cat.createdBy,
        updatedBy: cat.updatedBy,
      });

      for (const topic of subCat.topics) {
        topics.push({
          id: topic.id,
          tenantId: cat.tenantId,
          tenantName: cat.tenantName,
          categoryId: cat.id,
          categoryName: cat.name,
          subCategoryId: subCat.id,
          subCategoryName: subCat.name,
          name: topic.name,
          description: topic.description,
          createdBy: cat.createdBy,
          updatedBy: cat.updatedBy,
        });
      }
    }
  }

  return { categories, subCategories, topics };
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const nested = await listCategoriesNested();
  const { categories } = flattenCategories(nested);
  return categories;
}

export async function listCategoriesNested(): Promise<CategoryRecordNested[]> {
  const snapshot = await getDocs(collection(db, "categories"));
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        tenantId: toTrimmed(data.tenantId),
        tenantName: toTrimmed(data.tenantName) || undefined,
        name: toTrimmed(data.name),
        description: toTrimmed(data.description),
        subCategories: Array.isArray(data.subCategories)
          ? (data.subCategories as any[]).map((sub: any) => ({
              id: toTrimmed(sub.id),
              name: toTrimmed(sub.name),
              description: toTrimmed(sub.description) || undefined,
              topics: Array.isArray(sub.topics)
                ? (sub.topics as any[]).map((topic: any) => ({
                    id: toTrimmed(topic.id),
                    name: toTrimmed(topic.name),
                    description: toTrimmed(topic.description),
                  }))
                : [],
            }))
          : [],
        createdBy: toTrimmed(data.createdBy) || undefined,
        updatedBy: toTrimmed(data.updatedBy) || undefined,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } satisfies CategoryRecordNested;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSubCategories(): Promise<SubCategoryRecord[]> {
  const nested = await listCategoriesNested();
  const { subCategories } = flattenCategories(nested);
  return subCategories;
}

export async function listTopics(): Promise<TopicRecord[]> {
  const nested = await listCategoriesNested();
  const { topics } = flattenCategories(nested);
  return topics;
}

export async function listCategoriesFlattened(): Promise<{
  categories: CategoryRecord[];
  subCategories: SubCategoryRecord[];
  topics: TopicRecord[];
}> {
  const nested = await listCategoriesNested();
  return flattenCategories(nested);
}

export async function saveCategory(args: {
  id?: string;
  tenantId: string;
  tenantName: string;
  name: string;
  description: string;
  operatorId: string;
}): Promise<string> {
  const normalizedName = args.name.trim();
  const normalizedDescription = args.description.trim();

  const payload = {
    tenantId: args.tenantId.trim(),
    tenantName: args.tenantName.trim(),
    name: normalizedName,
    description: normalizedDescription,
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
  };

  if (args.id) {
    await setDoc(doc(db, "categories", args.id), payload, { merge: true });
    return args.id;
  }

  const created = await addDoc(collection(db, "categories"), {
    ...payload,
    createdBy: args.operatorId,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function saveSubCategory(args: {
  id?: string;
  tenantId: string;
  tenantName: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  operatorId: string;
}): Promise<string> {
  const normalizedName = args.name.trim();
  const normalizedDescription = args.description.trim();

  const payload = {
    tenantId: args.tenantId.trim(),
    tenantName: args.tenantName.trim(),
    categoryId: args.categoryId.trim(),
    categoryName: args.categoryName.trim(),
    name: normalizedName,
    description: normalizedDescription,
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
  };

  if (args.id) {
    await setDoc(doc(db, "subCategories", args.id), payload, { merge: true });
    return args.id;
  }

  const created = await addDoc(collection(db, "subCategories"), {
    ...payload,
    createdBy: args.operatorId,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function saveTopic(args: {
  id?: string;
  tenantId: string;
  tenantName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  name: string;
  description: string;
  operatorId: string;
}): Promise<string> {
  const normalizedName = args.name.trim();
  const normalizedDescription = args.description.trim();

  const payload = {
    tenantId: args.tenantId.trim(),
    tenantName: args.tenantName.trim(),
    categoryId: args.categoryId.trim(),
    categoryName: args.categoryName.trim(),
    subCategoryId: args.subCategoryId.trim(),
    subCategoryName: args.subCategoryName.trim(),
    name: normalizedName,
    description: normalizedDescription,
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
  };

  if (args.id) {
    await setDoc(doc(db, "topics", args.id), payload, { merge: true });
    return args.id;
  }

  const created = await addDoc(collection(db, "topics"), {
    ...payload,
    createdBy: args.operatorId,
    createdAt: serverTimestamp(),
  });
  return created.id;
}
