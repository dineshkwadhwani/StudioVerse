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
  LISTING_DURATION_UNIT_LABELS,
  LISTING_PACKAGE_DURATION_UNITS,
  LISTING_PACKAGE_RESOURCE_TYPES,
  type ListingPackageFormValues,
  type ListingPackageRecord,
  type ListingPackageStatus,
} from "@/types/listingPackage";

const COLLECTION = "listingPackages";

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapListingPackage(id: string, data: Record<string, unknown>): ListingPackageRecord {
  const resourceTypeRaw = toStringValue(data.resourceType);
  const durationUnitRaw = toStringValue(data.durationUnit);

  return {
    id,
    tenantId: toStringValue(data.tenantId),
    name: toStringValue(data.name),
    description: toStringValue(data.description),
    imageUrl: toStringValue(data.imageUrl) || undefined,
    imagePath: toStringValue(data.imagePath) || undefined,
    resourceType: LISTING_PACKAGE_RESOURCE_TYPES.includes(resourceTypeRaw as ListingPackageRecord["resourceType"])
      ? (resourceTypeRaw as ListingPackageRecord["resourceType"])
      : "program",
    durationValue: typeof data.durationValue === "number" ? data.durationValue : Number(data.durationValue) || 0,
    durationUnit: LISTING_PACKAGE_DURATION_UNITS.includes(durationUnitRaw as ListingPackageRecord["durationUnit"])
      ? (durationUnitRaw as ListingPackageRecord["durationUnit"])
      : "weeks",
    costCredits: typeof data.costCredits === "number" ? data.costCredits : Number(data.costCredits) || 0,
    status: (toStringValue(data.status) || "inactive") as ListingPackageStatus,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : Number(data.sortOrder) || 99,
    createdBy: toStringValue(data.createdBy),
    updatedBy: toStringValue(data.updatedBy),
    createdAt: data.createdAt as ListingPackageRecord["createdAt"],
    updatedAt: data.updatedAt as ListingPackageRecord["updatedAt"],
  };
}

export async function listListingPackages(tenantId?: string): Promise<ListingPackageRecord[]> {
  const base = collection(db, COLLECTION);
  const snap = tenantId
    ? await getDocs(query(base, where("tenantId", "==", tenantId)))
    : await getDocs(base);

  return snap.docs
    .map((row) => mapListingPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActiveListingPackagesForTenant(tenantId: string): Promise<ListingPackageRecord[]> {
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
    .map((row) => mapListingPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getListingPackageById(packageId: string): Promise<ListingPackageRecord | null> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), where(documentId(), "==", packageId.trim())),
  );

  if (snap.empty) {
    return null;
  }

  const row = snap.docs[0];
  return mapListingPackage(row.id, row.data() as Record<string, unknown>);
}

export function getListingPackageSummary(pkg: ListingPackageRecord): string {
  const unitLabel = LISTING_DURATION_UNIT_LABELS[pkg.durationUnit].toLowerCase();
  return `${pkg.durationValue} ${unitLabel} • ${pkg.costCredits} credits`;
}

export function validateListingPackageForm(values: ListingPackageFormValues): Record<string, string> {
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
    errors.costCredits = "Listing cost cannot be negative.";
  }

  return errors;
}

export async function saveListingPackage(
  values: ListingPackageFormValues,
  operatorId: string,
): Promise<ListingPackageRecord> {
  const errors = validateListingPackageForm(values);
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

  return mapListingPackage(ref.id, { ...payload, id: ref.id });
}

function sanitizeExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
    return ext;
  }
  return "jpg";
}

export function validateListingPackageImageFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

export async function uploadListingPackageImage(args: {
  tenantId: string;
  packageId: string;
  file: File;
}): Promise<{ imageUrl: string; imagePath: string }> {
  const ext = sanitizeExtension(args.file);
  const imagePath = `listingPackages/${args.tenantId}/${args.packageId}/image.${ext}`;
  const storageRef = ref(storage, imagePath);
  await uploadBytes(storageRef, args.file, { contentType: args.file.type });
  const imageUrl = await getDownloadURL(storageRef);
  return { imageUrl, imagePath };
}
