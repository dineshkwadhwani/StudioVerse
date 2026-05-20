import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  serverTimestamp,
  setDoc,
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
const EARNING_COLLECTION = "earningPackages";

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
  if (tenantId?.trim()) {
    const earningDoc = await getDoc(doc(db, EARNING_COLLECTION, tenantId.trim()));
    if (!earningDoc.exists()) return [];
    const data = earningDoc.data() as Record<string, unknown>;
    const packages = Array.isArray(data.promotionPackages) ? data.promotionPackages : [];
    return (packages as Record<string, unknown>[])
      .map((pkg) => mapPromotionPackage(String(pkg.id ?? ""), { ...pkg, tenantId: String(pkg.tenantId ?? tenantId.trim()) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const snap = await getDocs(collection(db, EARNING_COLLECTION));
  return snap.docs
    .flatMap((earningDoc) => {
      const data = earningDoc.data() as Record<string, unknown>;
      const packages = Array.isArray(data.promotionPackages) ? data.promotionPackages : [];
      return (packages as Record<string, unknown>[]).map((pkg) =>
        mapPromotionPackage(String(pkg.id ?? ""), { ...pkg, tenantId: String(pkg.tenantId ?? earningDoc.id) }),
      );
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActivePromotionPackagesForTenant(tenantId: string): Promise<PromotionPackageRecord[]> {
  if (!tenantId.trim()) return [];
  const packages = await listPromotionPackages(tenantId.trim());
  return packages.filter((pkg) => pkg.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPromotionPackageById(packageId: string): Promise<PromotionPackageRecord | null> {
  const normalizedPackageId = packageId.trim();
  if (!normalizedPackageId) return null;
  const allPackages = await listPromotionPackages();
  return allPackages.find((pkg) => pkg.id === normalizedPackageId) ?? null;
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
  if (!values.costCredits.trim() || !Number.isFinite(costCredits) || costCredits < 0) {
    errors.costCredits = "Promotion cost cannot be negative.";
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

  const tenantId = values.tenantId.trim();
  const earningRef = doc(db, EARNING_COLLECTION, tenantId);
  const earningSnap = await getDoc(earningRef);
  const earningData = earningSnap.exists() ? (earningSnap.data() as Record<string, unknown>) : {};
  const existingPackages = Array.isArray(earningData.promotionPackages)
    ? [...(earningData.promotionPackages as Record<string, unknown>[])]
    : [];
  const packageId = values.id?.trim() || doc(collection(db, COLLECTION)).id;
  const existingIndex = existingPackages.findIndex((pkg) => String(pkg.id ?? "") === packageId);
  const existingPackage = existingIndex >= 0 ? existingPackages[existingIndex] : undefined;
  const now = Timestamp.now();
  const payload: Record<string, unknown> = {
    tenantId,
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
    updatedAt: now,
    createdBy: String(existingPackage?.createdBy ?? operatorId),
    createdAt: existingPackage?.createdAt ?? now,
    id: packageId,
  };

  if (existingIndex >= 0) {
    existingPackages[existingIndex] = payload;
  } else {
    existingPackages.push(payload);
  }

  existingPackages.sort((a, b) => {
    const leftOrder = typeof a.sortOrder === "number" ? a.sortOrder : Number(a.sortOrder) || 99;
    const rightOrder = typeof b.sortOrder === "number" ? b.sortOrder : Number(b.sortOrder) || 99;
    return leftOrder - rightOrder;
  });

  await setDoc(
    earningRef,
    {
      tenantId,
      promotionPackages: existingPackages,
      updatedAt: serverTimestamp(),
      ...(earningSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  return mapPromotionPackage(packageId, payload);
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
