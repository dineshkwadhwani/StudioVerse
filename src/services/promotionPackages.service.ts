import {
  collection,
  documentId,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/services/firebase";
import {
  PROMOTION_DURATION_UNIT_LABELS,
  PROMOTION_PACKAGE_DURATION_UNITS,
  PROMOTION_PACKAGE_RESOURCE_TYPES,
  type PromotionPackageFormValues,
  type PromotionPackageRecord,
  type PromotionPackageStatus,
} from "@/types/promotionPackage";

const COLLECTION = "promotionPackages";

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapPromotionPackage(id: string, data: Record<string, unknown>): PromotionPackageRecord {
  const resourceTypeRaw = toStringValue(data.resourceType);
  const durationUnitRaw = toStringValue(data.durationUnit);

  return {
    id,
    tenantId: toStringValue(data.tenantId),
    name: toStringValue(data.name),
    description: toStringValue(data.description),
    imageUrl: toStringValue(data.imageUrl) || undefined,
    imagePath: toStringValue(data.imagePath) || undefined,
    resourceType: PROMOTION_PACKAGE_RESOURCE_TYPES.includes(resourceTypeRaw as PromotionPackageRecord["resourceType"])
      ? (resourceTypeRaw as PromotionPackageRecord["resourceType"])
      : "program",
    durationValue: typeof data.durationValue === "number" ? data.durationValue : Number(data.durationValue) || 0,
    durationUnit: PROMOTION_PACKAGE_DURATION_UNITS.includes(durationUnitRaw as PromotionPackageRecord["durationUnit"])
      ? (durationUnitRaw as PromotionPackageRecord["durationUnit"])
      : "weeks",
    costCredits: typeof data.costCredits === "number" ? data.costCredits : Number(data.costCredits) || 0,
    status: (toStringValue(data.status) || "inactive") as PromotionPackageStatus,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : Number(data.sortOrder) || 99,
    createdBy: toStringValue(data.createdBy),
    updatedBy: toStringValue(data.updatedBy),
    createdAt: data.createdAt as PromotionPackageRecord["createdAt"],
    updatedAt: data.updatedAt as PromotionPackageRecord["updatedAt"],
  };
}

export async function listPromotionPackages(tenantId?: string): Promise<PromotionPackageRecord[]> {
  const base = collection(db, COLLECTION);
  const snap = tenantId
    ? await getDocs(query(base, where("tenantId", "==", tenantId)))
    : await getDocs(base);

  return snap.docs
    .map((row) => mapPromotionPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActivePromotionPackagesForTenant(tenantId: string): Promise<PromotionPackageRecord[]> {
  if (!tenantId.trim()) {
    return [];
  }

  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where("tenantId", "==", tenantId.trim()),
      where("status", "==", "active"),
    ),
  );

  return snap.docs
    .map((row) => mapPromotionPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPromotionPackageById(packageId: string): Promise<PromotionPackageRecord | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where(documentId(), "==", packageId.trim())),
  );

  if (snap.empty) {
    return null;
  }

  const row = snap.docs[0];
  return mapPromotionPackage(row.id, row.data() as Record<string, unknown>);
}

export function getPromotionPackageSummary(pkg: PromotionPackageRecord): string {
  const unitLabel = PROMOTION_DURATION_UNIT_LABELS[pkg.durationUnit].toLowerCase();
  return `${pkg.durationValue} ${unitLabel} • ${pkg.costCredits} credits`;
}

export function validatePromotionPackageForm(values: PromotionPackageFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.tenantId.trim()) {
    errors.tenantId = "Tenant is required.";
  }
  if (!values.name.trim()) {
    errors.name = "Package name is required.";
  }

  const durationValue = Number(values.durationValue);
  if (!values.durationValue.trim() || !Number.isFinite(durationValue) || durationValue <= 0) {
    errors.durationValue = "Duration must be a positive number.";
  }

  const costCredits = Number(values.costCredits);
  if (!values.costCredits.trim() || !Number.isFinite(costCredits) || costCredits <= 0) {
    errors.costCredits = "Promotion cost must be a positive number of credits.";
  }

  return errors;
}

export async function savePromotionPackage(
  values: PromotionPackageFormValues,
  operatorId: string,
): Promise<PromotionPackageRecord> {
  const errors = validatePromotionPackageForm(values);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0]);
  }

  const ref = values.id ? doc(db, COLLECTION, values.id) : doc(collection(db, COLLECTION));
  const existingDoc = values.id ? await getDoc(ref) : null;
  const isExisting = Boolean(existingDoc?.exists());

  const payload: Record<string, unknown> = {
    tenantId: values.tenantId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl.trim() || null,
    imagePath: values.imagePath.trim() || null,
    resourceType: values.resourceType,
    durationValue: Number(values.durationValue),
    durationUnit: values.durationUnit,
    costCredits: Number(values.costCredits),
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

  return mapPromotionPackage(ref.id, { ...payload, id: ref.id });
}

function sanitizeExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
    return ext;
  }
  return "jpg";
}

export function validatePromotionPackageImageFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

export async function uploadPromotionPackageImage(args: {
  tenantId: string;
  packageId: string;
  file: File;
}): Promise<{ imageUrl: string; imagePath: string }> {
  const ext = sanitizeExtension(args.file);
  const imagePath = `promotionPackages/${args.tenantId}/${args.packageId}/image.${ext}`;
  const storageRef = ref(storage, imagePath);
  await uploadBytes(storageRef, args.file, { contentType: args.file.type });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, imagePath };
}
