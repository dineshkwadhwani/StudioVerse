// ============================================================
// Events service — EPIC E3
//
// All Firestore access for events is isolated here.
// Business logic (auth enforcement, audit logging) should
// migrate to Firebase Functions in the next phase.
//
// TODO (Phase 2): Replace direct Firestore writes with
//   Firebase callable functions createEvent / updateEvent
//   so that server-side auth, validation, and audit logging
//   are enforced outside the browser.
// ============================================================

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, functions, storage } from "@/services/firebase";
import {
  type EventRecord,
  type EventSaveMode,
  type EventWriteInput,
} from "@/types/event";

const createEventCallable = httpsCallable<Record<string, unknown>, { id: string; status: string }>(functions, "createEvent");
const updateEventCallable = httpsCallable<Record<string, unknown>, { id: string; status: string }>(functions, "updateEvent");

// ---------------------------------------------------------------------------
// Timestamp coercion shared helper
// ---------------------------------------------------------------------------
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function toDateTimeString(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

// ---------------------------------------------------------------------------
// Map Firestore document → EventRecord
// ---------------------------------------------------------------------------
function mapEvent(id: string, data: DocumentData): EventRecord {
  const fallbackLocation = typeof data.location === "string" ? data.location : "";
  const visibility = data.visibility === "private" || data.catalogVisibility === "professional_only"
    ? "private"
    : "public";

  return {
    id,
    tenantId: data.tenantId,
    tenantIds: Array.isArray(data.tenantIds) ? data.tenantIds : undefined,
    name: data.name,
    eventType: data.eventType ?? "webinar",
    eventSource: data.eventSource ?? "studioverse_manager",
    shortDescription: data.shortDescription ?? "",
    longDescription: data.longDescription ?? "",
    thumbnailUrl: data.thumbnailUrl ?? null,
    thumbnailPath: data.thumbnailPath ?? null,
    eventDate: data.eventDate ?? null,
    eventTime: data.eventTime ?? null,
    eventDateTime: toDateTimeString(data.eventDateTime),
    locationAddress: data.locationAddress ?? fallbackLocation,
    locationCity: data.locationCity ?? "",
    details: data.details ?? "",
    videoUrl: data.videoUrl ?? null,
    creditsRequired: data.creditsRequired ?? 0,
    cost: data.cost ?? 0,
    status: data.status,
    promoted: Boolean(data.promoted),
    visibility,
    ownershipScope: data.ownershipScope,
    ownerEntityId: data.ownerEntityId ?? null,
    catalogVisibility: data.catalogVisibility,
    publicationState: data.publicationState,
    createdBy: data.createdBy ?? "",
    updatedBy: data.updatedBy ?? "",
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    publishedAt: toDate(data.publishedAt),
    archivedAt: toDate(data.archivedAt),
    cancelledAt: toDate(data.cancelledAt),
  };
}

// ---------------------------------------------------------------------------
// Prepare payload for callable function — strip undefined so optional fields
// are treated as absent instead of explicit null.
// ---------------------------------------------------------------------------
function sanitizePayload(input: EventWriteInput): Record<string, unknown> {
  const nullToUndef = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
  const payload: Record<string, unknown> = {
    tenantId: input.tenantId,
    tenantIds: input.tenantIds,
    name: input.name,
    eventType: input.eventType,
    eventSource: input.eventSource,
    shortDescription: input.shortDescription,
    longDescription: input.longDescription,
    thumbnailUrl: nullToUndef(input.thumbnailUrl),
    thumbnailPath: nullToUndef(input.thumbnailPath),
    eventDate: nullToUndef(input.eventDate),
    eventTime: nullToUndef(input.eventTime),
    eventDateTime: nullToUndef(input.eventDateTime),
    locationAddress: input.locationAddress,
    locationCity: input.locationCity,
    details: input.details,
    videoUrl: nullToUndef(input.videoUrl),
    creditsRequired: input.creditsRequired,
    cost: input.cost,
    status: input.status,
    promoted: input.promoted,
    visibility: input.visibility,
    ownershipScope: input.ownershipScope,
    ownerEntityId: nullToUndef(input.ownerEntityId),
    catalogVisibility: input.catalogVisibility,
    publicationState: input.publicationState,
    id: nullToUndef(input.id),
  };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Public read functions
// ---------------------------------------------------------------------------

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

export async function listEvents(tenantId?: string): Promise<EventRecord[]> {
  const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc")];
  const snapshot = await getDocs(
    query(collection(db, "events"), ...constraints),
  );
  const rows = snapshot.docs.map((item) => mapEvent(item.id, item.data()));

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

export async function getEvent(eventId: string): Promise<EventRecord | null> {
  const snapshot = await getDoc(doc(db, "events", eventId));
  if (!snapshot.exists()) return null;
  return mapEvent(snapshot.id, snapshot.data());
}

// ---------------------------------------------------------------------------
// Write functions
//
// callerUid is passed in from the already-authenticated admin session.
// TODO (Phase 2): Move to Firebase callable functions so auth is enforced
//   server-side and audit logs are written automatically.
// ---------------------------------------------------------------------------

export async function createEvent(
  input: EventWriteInput,
): Promise<{ id: string }> {
  const result = await createEventCallable(sanitizePayload(input));
  return { id: result.data.id };
}

export async function updateEvent(
  input: EventWriteInput,
): Promise<{ id: string }> {
  if (!input.id) {
    throw new Error("updateEvent requires an event id.");
  }
  const result = await updateEventCallable(sanitizePayload(input));
  return { id: result.data.id };
}

export async function saveEvent(
  input: EventWriteInput,
  _mode: EventSaveMode,
  isExisting: boolean,
): Promise<{ id: string }> {
  return isExisting
    ? updateEvent(input)
    : createEvent(input);
}

// ---------------------------------------------------------------------------
// Thumbnail upload
// ---------------------------------------------------------------------------

function sanitizeExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") {
    return ext;
  }
  return "jpg";
}

export function validateEventThumbnailFile(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Use a JPG, PNG, or WebP image for the thumbnail.";
  }
  if (file.size > 2 * 1024 * 1024) {
    return "Thumbnail must be 2MB or smaller.";
  }
  return null;
}

export async function uploadEventThumbnail(args: {
  tenantId: string;
  eventId: string;
  file: File;
}): Promise<{ thumbnailUrl: string; thumbnailPath: string }> {
  const ext = sanitizeExtension(args.file);
  const thumbnailPath = `events/${args.tenantId}/${args.eventId}/thumbnail.${ext}`;
  const storageRef = ref(storage, thumbnailPath);
  await uploadBytes(storageRef, args.file, { contentType: args.file.type });
  const thumbnailUrl = await getDownloadURL(storageRef);
  return { thumbnailUrl, thumbnailPath };
}

export function buildEventId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Landing-page promoted query
//
// Promote rules (E3 §16):
//   promoted=true AND status=published AND publicationState=published
//   AND not cancelled AND not archived
// Returns promoted events first ordered by nearest upcoming eventDateTime,
// then remaining published events.
// ---------------------------------------------------------------------------
export async function listLandingPageEvents(
  tenantId: string,
): Promise<EventRecord[]> {
  const constraints: QueryConstraint[] = [
    where("status", "==", "published"),
    where("publicationState", "==", "published"),
  ];
  const snapshot = await getDocs(
    query(collection(db, "events"), ...constraints),
  );
  const all = snapshot.docs
    .map((d) => mapEvent(d.id, d.data()))
    .filter((item) => item.visibility === "public")
    .filter((item) =>
      matchesTenantScope({
        primaryTenantId: item.tenantId,
        tenantIds: item.tenantIds,
        selectedTenantId: tenantId,
      })
    );

  const now = new Date().toISOString();

  const promoted = all
    .filter((e) => e.promoted)
    .sort((a, b) => {
      // nearest upcoming first, fall back to most recently updated
      const aTime = a.eventDateTime ?? "";
      const bTime = b.eventDateTime ?? "";
      if (aTime >= now && bTime >= now) return aTime < bTime ? -1 : 1;
      if (aTime >= now) return -1;
      if (bTime >= now) return 1;
      // both past — most recently updated first
      return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
    });

  const others = all
    .filter((e) => !e.promoted)
    .sort((a, b) => {
      const aTime = a.eventDateTime ?? "";
      const bTime = b.eventDateTime ?? "";
      if (aTime < bTime) return -1;
      if (aTime > bTime) return 1;
      return 0;
    });

  return [...promoted, ...others];
}
