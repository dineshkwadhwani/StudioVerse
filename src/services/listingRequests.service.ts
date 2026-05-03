import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { sendNotificationToUser } from "@/services/notification.service";
import { buildWalletId } from "@/services/wallet.service";
import type { WalletUserType } from "@/types/wallet";

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

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function resolveRequesterRole(requesterId: string): Promise<WalletUserType | null> {
  const directSnap = await getDoc(doc(db, "users", requesterId));
  if (directSnap.exists()) {
    return String((directSnap.data() as Record<string, unknown>).userType ?? "") as WalletUserType;
  }

  const byUserIdSnap = await getDocs(query(collection(db, "users"), where("userId", "==", requesterId), limit(1)));
  if (!byUserIdSnap.empty) {
    return String((byUserIdSnap.docs[0].data() as Record<string, unknown>).userType ?? "") as WalletUserType;
  }

  const byUidSnap = await getDocs(query(collection(db, "users"), where("uid", "==", requesterId), limit(1)));
  if (!byUidSnap.empty) {
    return String((byUidSnap.docs[0].data() as Record<string, unknown>).userType ?? "") as WalletUserType;
  }

  return null;
}

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
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

  const tenantId = String(data?.tenantId ?? "").trim();
  const requesterId = String(data?.updatedBy ?? data?.createdBy ?? "").trim();
  const requesterRole = requesterId ? await resolveRequesterRole(requesterId) : null;
  const isRequesterSuperAdmin = requesterRole === "superadmin";

  if (!isRequesterSuperAdmin) {
    const listingPackageId = String(data?.listingPackageId ?? "").trim();
    if (!tenantId || !requesterId || !listingPackageId) {
      throw new Error("Missing listing request context for wallet debit.");
    }

    const listingPackageSnap = await getDoc(doc(db, "listingPackages", listingPackageId));
    if (!listingPackageSnap.exists()) {
      throw new Error("Listing package not found for this approval request.");
    }

    const listingCostCredits = toSafeNumber((listingPackageSnap.data() as Record<string, unknown>).costCredits);

    await runTransaction(db, async (transaction) => {
      const scopedWalletId = buildWalletId(requesterId, tenantId);
      const scopedWalletRef = doc(db, "wallets", scopedWalletId);
      const legacyWalletRef = doc(db, "wallets", requesterId);
      const walletTxRef = doc(collection(db, "walletTransactions"));

      const [scopedWalletSnap, legacyWalletSnap] = await Promise.all([
        transaction.get(scopedWalletRef),
        transaction.get(legacyWalletRef),
      ]);

      const scopedData = scopedWalletSnap.exists() ? (scopedWalletSnap.data() as Record<string, unknown>) : null;
      const legacyData = legacyWalletSnap.exists() ? (legacyWalletSnap.data() as Record<string, unknown>) : null;
      const useLegacy = !scopedData && Boolean(legacyData && String(legacyData.tenantId ?? "") === tenantId);
      const walletData = scopedData ?? (useLegacy ? legacyData : null);

      if (!walletData) {
        throw new Error("Requester wallet not found for listing approval charge.");
      }

      const availableCoins = toSafeNumber(walletData.availableCoins);
      const utilizedCoins = toSafeNumber(walletData.utilizedCoins);

      if (listingCostCredits > availableCoins) {
        throw new Error(`Insufficient wallet balance for listing approval. Required ${listingCostCredits}, available ${availableCoins}.`);
      }

      const targetWalletRef = useLegacy ? legacyWalletRef : scopedWalletRef;
      const targetWalletId = useLegacy ? requesterId : scopedWalletId;
      const walletUserType = String(walletData.userType ?? "individual") as WalletUserType;
      const walletUserName = String(walletData.userName ?? "User");

      transaction.set(
        targetWalletRef,
        {
          availableCoins: availableCoins - listingCostCredits,
          utilizedCoins: utilizedCoins + listingCostCredits,
          updatedBy: args.operatorId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      if (listingCostCredits > 0) {
        transaction.set(walletTxRef, {
          walletId: targetWalletId,
          userId: requesterId,
          tenantId,
          userType: walletUserType,
          userName: walletUserName,
          transactionType: "debit",
          reason: `Listing approval charge (${args.resourceType})`,
          coins: listingCostCredits,
          createdBy: args.operatorId,
          createdAt: serverTimestamp(),
        });
      }

      transaction.set(
        ref,
        {
          status: "published",
          publicationState: "published",
          listingStatus: "approved",
          updatedBy: args.operatorId,
          updatedAt: serverTimestamp(),
          publishedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  } else {
    await updateDoc(ref, {
      status: "published",
      publicationState: "published",
      listingStatus: "approved",
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
      publishedAt: serverTimestamp(),
    });
  }

  const resourceName = String(data?.name ?? "Listing").trim() || "Listing";

  if (tenantId && requesterId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: requesterId,
        notificationType: "promotionApproved",
        templateVariables: {
          resourceType: `${args.resourceType} listing`,
          resourceName,
        },
        metadata: {
          resourceType: args.resourceType,
          resourceId: args.id,
          source: "listingApproval",
        },
      });
    } catch {
      // Listing approval should not fail if notification fails.
    }
  }
}

export async function denyListingRequest(args: {
  resourceType: ListingRequestResourceType;
  id: string;
  operatorId: string;
}): Promise<void> {
  const ref = doc(db, getCollection(args.resourceType), args.id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  const rejectedPublicationState = args.resourceType === "assessment" ? "rejected_publication" : "rejected_publication";

  await updateDoc(ref, {
    status: "draft",
    publicationState: rejectedPublicationState,
    listingStatus: "rejected",
    updatedBy: args.operatorId,
    updatedAt: serverTimestamp(),
  });

  const tenantId = String(data?.tenantId ?? "").trim();
  const requesterId = String(data?.updatedBy ?? data?.createdBy ?? "").trim();
  const resourceName = String(data?.name ?? "Listing").trim() || "Listing";

  if (tenantId && requesterId) {
    try {
      await sendNotificationToUser({
        tenantId,
        userId: requesterId,
        notificationType: "promotionDenied",
        templateVariables: {
          resourceType: `${args.resourceType} listing`,
          resourceName,
          reason: "Listing request denied by Super Admin",
        },
        metadata: {
          resourceType: args.resourceType,
          resourceId: args.id,
          source: "listingDenial",
        },
      });
    } catch {
      // Listing denial should not fail if notification fails.
    }
  }
}
