import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  Timestamp,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/services/firebase";
import type { CoinPackageFormValues, CoinPackageRecord, CoinPackageStatus } from "@/types/coinPackage";

const COLLECTION = "coinPackages";
const EARNING_COLLECTION = "earningPackages";

type SaveCoinPackageOptions = {
  isNew?: boolean;
  tenantId?: string;
};

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

async function readCoinPackagesFromEarning(tenantId: string): Promise<{ found: boolean; packages: CoinPackageRecord[] }> {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) {
    return { found: false, packages: [] };
  }

  const earningDoc = await getDoc(doc(db, EARNING_COLLECTION, normalizedTenantId));
  if (!earningDoc.exists()) {
    return { found: false, packages: [] };
  }

  const data = earningDoc.data() as Record<string, unknown>;
  const packages = Array.isArray(data.creditPackages) ? data.creditPackages : [];
  return {
    found: true,
    packages: (packages as Record<string, unknown>[])
      .map((pkg) => mapCoinPackage(String(pkg.id ?? ""), pkg))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export async function listCoinPackagesFromEarning(tenantId: string): Promise<CoinPackageRecord[]> {
  try {
    const result = await readCoinPackagesFromEarning(tenantId);
    if (result.found) {
      return result.packages;
    }
  } catch {
    // Fall through to old collection
  }
  return listCoinPackages();
}

export async function listCoinPackages(tenantId?: string): Promise<CoinPackageRecord[]> {
  const normalizedTenantId = tenantId?.trim() ?? "";
  if (normalizedTenantId) {
    try {
      const result = await readCoinPackagesFromEarning(normalizedTenantId);
      if (result.found) {
        return result.packages;
      }
    } catch {
      // Fall through to legacy collection read.
    }
  }

  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .map((row) => mapCoinPackage(row.id, row.data() as Record<string, unknown>))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listActiveCoinPackages(tenantId?: string): Promise<CoinPackageRecord[]> {
  const normalizedTenantId = tenantId?.trim() ?? "";
  if (normalizedTenantId) {
    try {
      const result = await readCoinPackagesFromEarning(normalizedTenantId);
      if (result.found) {
        return result.packages.filter((pkg) => pkg.status === "active");
      }
    } catch {
      // Fall through to legacy collection read.
    }
  }

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
  operatorId: string,
  options?: boolean | SaveCoinPackageOptions
): Promise<CoinPackageRecord> {
  const errors = validateCoinPackageForm(values);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0]);
  }

  const normalizedOptions: SaveCoinPackageOptions =
    typeof options === "boolean" ? { isNew: options } : (options ?? {});

  const tenantId = normalizedOptions.tenantId?.trim() ?? "";
  if (tenantId) {
    const earningRef = doc(db, EARNING_COLLECTION, tenantId);
    const earningSnap = await getDoc(earningRef);
    const earningData = earningSnap.exists() ? (earningSnap.data() as Record<string, unknown>) : {};
    const existingPackages = Array.isArray(earningData.creditPackages)
      ? [...(earningData.creditPackages as Record<string, unknown>[])]
      : [];
    const packageId = values.id?.trim() || doc(collection(db, COLLECTION)).id;
    const existingIndex = existingPackages.findIndex((pkg) => String(pkg.id ?? "") === packageId);
    const existingPackage = existingIndex >= 0 ? existingPackages[existingIndex] : undefined;
    const now = Timestamp.now();
    const nextPackage: Record<string, unknown> = {
      ...(existingPackage ?? {}),
      id: packageId,
      name: values.name.trim(),
      description: values.description.trim(),
      imageUrl: values.imageUrl.trim() || null,
      imagePath: values.imagePath.trim() || null,
      credits: Number(values.credits),
      priceInr: Number(values.priceInr),
      status: values.status,
      sortOrder: Number(values.sortOrder) || 99,
      updatedBy: operatorId,
      updatedAt: now,
      createdBy: String(existingPackage?.createdBy ?? operatorId),
      createdAt: existingPackage?.createdAt ?? now,
    };

    if (existingIndex >= 0) {
      existingPackages[existingIndex] = nextPackage;
    } else {
      existingPackages.push(nextPackage);
    }

    existingPackages.sort((left, right) => {
      const leftOrder = typeof left.sortOrder === "number" ? left.sortOrder : Number(left.sortOrder) || 99;
      const rightOrder = typeof right.sortOrder === "number" ? right.sortOrder : Number(right.sortOrder) || 99;
      return leftOrder - rightOrder;
    });

    await setDoc(
      earningRef,
      {
        tenantId,
        creditPackages: existingPackages,
        updatedAt: serverTimestamp(),
        ...(earningSnap.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    return mapCoinPackage(packageId, nextPackage);
  }

  const docRef = values.id ? doc(db, COLLECTION, values.id) : doc(collection(db, COLLECTION));
  const isCreate = normalizedOptions.isNew ?? !values.id;

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

  if (isCreate) {
    payload.createdBy = operatorId;
    payload.createdAt = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });

  return mapCoinPackage(docRef.id, { ...payload, id: docRef.id });
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
