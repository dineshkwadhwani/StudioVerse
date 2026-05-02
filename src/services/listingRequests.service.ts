import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export type ListingRequestResourceType = "program" | "event" | "assessment";

export type ListingRequestRecord = {
  id: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  listingPackageId: string | null;
  listingStatus: "none" | "requested" | "approved" | "rejected";
  publicationState: string;
  resourceType: ListingRequestResourceType;
};

function toListingStatus(value: unknown, publicationState: unknown): ListingRequestRecord["listingStatus"] {
  if (value === "none" || value === "requested" || value === "approved" || value === "rejected") {
    return value;
  }
  if (publicationState === "pending_publication_review") {
    return "requested";
  }
  return "none";
}

function mapProgram(id: string, data: DocumentData): ListingRequestRecord {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    name: String(data.name ?? "Untitled Program"),
    shortDescription: String(data.shortDescription ?? ""),
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : null,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: toListingStatus(data.listingStatus, data.publicationState),
    publicationState: String(data.publicationState ?? "draft"),
    resourceType: "program",
  };
}

function mapEvent(id: string, data: DocumentData): ListingRequestRecord {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    name: String(data.name ?? "Untitled Event"),
    shortDescription: String(data.shortDescription ?? ""),
    thumbnailUrl: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : null,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: toListingStatus(data.listingStatus, data.publicationState),
    publicationState: String(data.publicationState ?? "draft"),
    resourceType: "event",
  };
}

function mapAssessment(id: string, data: DocumentData): ListingRequestRecord {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    name: String(data.name ?? "Untitled Assessment"),
    shortDescription: String(data.shortDescription ?? ""),
    thumbnailUrl: typeof data.assessmentImageUrl === "string" ? data.assessmentImageUrl : null,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: toListingStatus(data.listingStatus, data.publicationState),
    publicationState: String(data.publicationState ?? "unpublished"),
    resourceType: "assessment",
  };
}

export async function listListingRequests(tenantId?: string): Promise<ListingRequestRecord[]> {
  const [programSnap, eventSnap, assessmentSnap] = await Promise.all([
    getDocs(collection(db, "programs")),
    getDocs(collection(db, "events")),
    getDocs(collection(db, "assessments")),
  ]);

  const rows: ListingRequestRecord[] = [
    ...programSnap.docs.map((row) => mapProgram(row.id, row.data())),
    ...eventSnap.docs.map((row) => mapEvent(row.id, row.data())),
    ...assessmentSnap.docs.map((row) => mapAssessment(row.id, row.data())),
  ];

  return rows
    .filter((row) => row.listingStatus === "requested" || row.publicationState === "pending_publication_review")
    .filter((row) => !tenantId || row.tenantId === tenantId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getCollection(resourceType: ListingRequestResourceType): "programs" | "events" | "assessments" {
  if (resourceType === "event") {
    return "events";
  }
  if (resourceType === "assessment") {
    return "assessments";
  }
  return "programs";
}

export async function approveListingRequest(args: {
  resourceType: ListingRequestResourceType;
  id: string;
  operatorId: string;
}): Promise<void> {
  const ref = doc(db, getCollection(args.resourceType), args.id);
  await updateDoc(ref, {
    status: "published",
    publicationState: "published",
    listingStatus: "approved",
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
    publishedAt: serverTimestamp(),
  });
}

export async function denyListingRequest(args: {
  resourceType: ListingRequestResourceType;
  id: string;
  operatorId: string;
}): Promise<void> {
  const ref = doc(db, getCollection(args.resourceType), args.id);
  const rejectedPublicationState = args.resourceType === "assessment" ? "rejected_publication" : "rejected_publication";

  await updateDoc(ref, {
    status: "draft",
    publicationState: rejectedPublicationState,
    listingStatus: "rejected",
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
  });
}
