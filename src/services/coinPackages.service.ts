import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/services/firebase";
import type { CoinPackageFormValues, CoinPackageRecord, CoinPackageStatus } from "@/types/coinPackage";

const COLLECTION = "coinPackages";

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapCoinPackage(id: string, data: Record<string, unknown>): CoinPackageRecord {
  return {
    id,
    name: toStringValue(data.name),
    description: toStringValue(data.description),
    imageUrl: toStringValue(data.imageUrl) || undefined,
    imagePath: toStringValue(data.imagePath) || undefined,
    credits: typeof data.credits === "number" ? data.credits : Number(data.credits) || 0,
    priceInr: typeof data.priceInr === "number" ? data.priceInr : Number(data.priceInr) || 0,
    status: (toStringValue(data.status) || "inactive") as CoinPackageStatus,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : Number(data.sortOrder) || 99,
    createdBy: toStringValue(data.createdBy),
    updatedBy: toStringValue(data.updatedBy),
    createdAt: data.createdAt as CoinPackageRecord["createdAt"],
    updatedAt: data.updatedAt as CoinPackageRecord["updatedAt"],
  };
}

export async function listCoinPackages(): Promise<CoinPackageRecord[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((row) => mapCoinPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActiveCoinPackages(): Promise<CoinPackageRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where("status", "==", "active"))
  );
  return snap.docs
    .map((row) => mapCoinPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function validateCoinPackageForm(values: CoinPackageFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = "Package name is required.";
  const credits = Number(values.credits);
  if (!values.credits.trim() || !Number.isFinite(credits) || credits <= 0) {
    errors.credits = "Credits must be a positive number.";
  }
  const price = Number(values.priceInr);
  if (!values.priceInr.trim() || !Number.isFinite(price) || price <= 0) {
    errors.priceInr = "Price must be a positive number.";
  }
  return errors;
}

export async function saveCoinPackage(
  values: CoinPackageFormValues,
  operatorId: string
): Promise<CoinPackageRecord> {
  const errors = validateCoinPackageForm(values);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0]);
  }

  const isExisting = Boolean(values.id);
  const ref = values.id ? doc(db, COLLECTION, values.id) : doc(collection(db, COLLECTION));

  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl.trim() || null,
    imagePath: values.imagePath.trim() || null,
    credits: Number(values.credits),
    priceInr: Number(values.priceInr),
    status: values.status,
    sortOrder: Number(values.sortOrder) || 99,
    updatedBy: operatorId,
    updatedAt: serverTimestamp(),
  };

  if (isExisting) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, {
      ...payload,
      createdBy: operatorId,
      createdAt: serverTimestamp(),
    });
  }

  return mapCoinPackage(ref.id, { ...payload, id: ref.id });
}

function sanitizeExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
    return ext;
  }
  return "jpg";
}

export function validateCoinPackageImageFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

export async function uploadCoinPackageImage(args: {
  packageId: string;
  file: File;
}): Promise<{ imageUrl: string; imagePath: string }> {
  const ext = sanitizeExtension(args.file);
  const imagePath = `coinPackages/${args.packageId}/image.${ext}`;
  const storageRef = ref(storage, imagePath);
  await uploadBytes(storageRef, args.file, { contentType: args.file.type });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, imagePath };
}
