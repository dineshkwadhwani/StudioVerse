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
import { db } from "@/services/firebase";
import type { CategoryRecord, SubCategoryRecord } from "@/types/category";

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const snapshot = await getDocs(query(collection(db, "categories"), orderBy("name", "asc")));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      tenantId: toTrimmed(data.tenantId),
      tenantName: toTrimmed(data.tenantName) || undefined,
      name: toTrimmed(data.name),
      description: toTrimmed(data.description),
      createdBy: toTrimmed(data.createdBy) || undefined,
      updatedBy: toTrimmed(data.updatedBy) || undefined,
    } satisfies CategoryRecord;
  });
}

export async function listSubCategories(): Promise<SubCategoryRecord[]> {
  const snapshot = await getDocs(query(collection(db, "subCategories"), orderBy("name", "asc")));
  return snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      id: entry.id,
      tenantId: toTrimmed(data.tenantId),
      tenantName: toTrimmed(data.tenantName) || undefined,
      categoryId: toTrimmed(data.categoryId),
      categoryName: toTrimmed(data.categoryName) || undefined,
      name: toTrimmed(data.name),
      description: toTrimmed(data.description),
      createdBy: toTrimmed(data.createdBy) || undefined,
      updatedBy: toTrimmed(data.updatedBy) || undefined,
    } satisfies SubCategoryRecord;
  });
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
