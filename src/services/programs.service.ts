import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import {getDownloadURL, ref, uploadBytes} from "firebase/storage";
import {httpsCallable} from "firebase/functions";
import {db, functions, storage} from "@/services/firebase";
import {
  type ProgramRecord,
  type ProgramSaveMode,
  type ProgramWriteInput,
} from "@/types/program";

const createProgramCallable = httpsCallable<Record<string, unknown>, { id: string; status: string }>(functions, "createProgram");
const updateProgramCallable = httpsCallable<Record<string, unknown>, { id: string; status: string }>(functions, "updateProgram");

/**
 * Converts null to undefined for all optional fields before passing to the
 * Firebase callable. JSON serialisation drops undefined (treating it as absent),
 * which satisfies Zod's `.optional()` on the backend regardless of which
 * deployed version is live.
 */
function sanitizePayload(input: ProgramWriteInput): Record<string, unknown> {
  const nullToUndef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
  const result: Record<string, unknown> = {
    tenantId: input.tenantId,
    tenantIds: input.tenantIds,
    name: input.name,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    deliveryType: input.deliveryType,
    durationValue: input.durationValue,
    durationUnit: input.durationUnit,
    details: input.details,
    creditsRequired: input.creditsRequired,
    status: input.status,
    promoted: input.promoted,
    visibility: input.visibility,
    ownershipScope: input.ownershipScope,
    catalogVisibility: input.catalogVisibility,
    publicationState: input.publicationState,
    // optional — send undefined (absent) rather than null
    id: nullToUndef(input.id),
    thumbnailUrl: nullToUndef(input.thumbnailUrl),
    thumbnailPath: nullToUndef(input.thumbnailPath),
    videoUrl: nullToUndef(input.videoUrl),
    availableFrom: nullToUndef(input.availableFrom),
    expiresAt: nullToUndef(input.expiresAt),
    facilitatorName: nullToUndef(input.facilitatorName),
    ownerEntityId: nullToUndef(input.ownerEntityId),
  };

  // Strip undefined keys so they are omitted from the JSON payload
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) {
      delete result[key];
    }
  }

  console.debug("[programs.service] callable payload:", JSON.stringify(result, null, 2));
  return result;
}

function toDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
}

function mapProgram(id: string, data: DocumentData): ProgramRecord {
  const visibility = data.visibility === "private" || data.catalogVisibility === "professional_only"
    ? "private"
    : "public";
  return {
    id,
    tenantId: data.tenantId,
    tenantIds: Array.isArray(data.tenantIds) ? data.tenantIds : undefined,
    name: data.name,
    shortDescription: data.shortDescription,
    longDescription: data.longDescription,
    thumbnailUrl: data.thumbnailUrl ?? null,
    thumbnailPath: data.thumbnailPath ?? null,
    deliveryType: data.deliveryType,
    durationValue: data.durationValue,
    durationUnit: data.durationUnit,
    details: data.details,
    videoUrl: data.videoUrl ?? null,
    creditsRequired: data.creditsRequired,
    availableFrom: toDate(data.availableFrom),
    expiresAt: toDate(data.expiresAt),
    status: data.status,
    facilitatorName: data.facilitatorName ?? null,
    promoted: Boolean(data.promoted),
    visibility,
    ownershipScope: data.ownershipScope,
    ownerEntityId: data.ownerEntityId ?? null,
    catalogVisibility: data.catalogVisibility,
    publicationState: data.publicationState,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: toDate(data.publishedAt),
    archivedAt: toDate(data.archivedAt),
  };
}

function matchesTenantScope(args: {
  primaryTenantId: string;
  tenantIds?: string[];
  selectedTenantId: string;
}): boolean {
  if (args.primaryTenantId === args.selectedTenantId) {
    return true;
  }

  if (!Array.isArray(args.tenantIds) || args.tenantIds.length === 0) {
    return false;
  }

  return args.tenantIds.includes(args.selectedTenantId);
}

export async function listPrograms(tenantId?: string): Promise<ProgramRecord[]> {
  const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc")];

  const snapshot = await getDocs(query(collection(db, "programs"), ...constraints));
  const rows = snapshot.docs.map((item) => mapProgram(item.id, item.data()));

  if (!tenantId) {
    return rows;
  }

  return rows.filter((item) =>
    matchesTenantScope({
      primaryTenantId: item.tenantId,
      tenantIds: item.tenantIds,
      selectedTenantId: tenantId,
    })
  );
}

export async function getProgram(programId: string): Promise<ProgramRecord | null> {
  const snapshot = await getDoc(doc(db, "programs", programId));
  if (!snapshot.exists()) {
    return null;
  }
  return mapProgram(snapshot.id, snapshot.data());
}

export async function createProgram(input: ProgramWriteInput): Promise<{ id: string }> {
  const result = await createProgramCallable(sanitizePayload(input));
  return { id: result.data.id };
}

export async function updateProgram(input: ProgramWriteInput): Promise<{ id: string }> {
  const result = await updateProgramCallable(sanitizePayload(input));
  return { id: result.data.id };
}

function sanitizeExtension(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
    return extension;
  }
  return "jpg";
}

export function validateThumbnailFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image for the thumbnail.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Thumbnail must be 2MB or smaller.";
  }
  return null;
}

export async function uploadProgramThumbnail(args: {
  tenantId: string;
  programId: string;
  file: File;
}): Promise<{ thumbnailUrl: string; thumbnailPath: string }> {
  const extension = sanitizeExtension(args.file);
  const thumbnailPath = `programs/${args.tenantId}/${args.programId}/thumbnail.${extension}`;
  const storageRef = ref(storage, thumbnailPath);
  await uploadBytes(storageRef, args.file, { contentType: args.file.type });
  const thumbnailUrl = await getDownloadURL(storageRef);
  return { thumbnailUrl, thumbnailPath };
}

export function buildProgramId(): string {
  return crypto.randomUUID();
}

/**
 * isExisting: true  → the record is already persisted in Firestore (opened via Edit)
 *             false → brand-new program, must call createProgram regardless of id
 */
export async function saveProgram(
  input: ProgramWriteInput,
  mode: ProgramSaveMode,
  isExisting: boolean,
): Promise<{ id: string }> {
  if (isExisting) {
    return updateProgram(input);
  }
  return createProgram(input);
}
