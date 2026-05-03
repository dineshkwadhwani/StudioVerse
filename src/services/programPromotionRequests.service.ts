import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { type AssessmentPromotionStatus, type AssessmentRecord } from "@/types/assessment";
import { db } from "@/services/firebase";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
import { sendNotificationToUser, sendAdminAlertToMasterSuperadmin } from "@/services/notification.service";
import { type EventPromotionStatus, type EventRecord } from "@/types/event";
import { type ProgramPromotionStatus, type ProgramRecord } from "@/types/program";

export type PromotionRequestRecord = {
  id: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  thumbnailUrl: string | null;
  promotionPackageId: string | null;
  promotionStatus: "requested" | "promoted" | "none";
  resourceType: "program" | "event" | "assessment";
};

function toPromotionStatus(value: unknown, promoted: unknown, promotionPackageId: unknown): ProgramPromotionStatus {
  if (value === "requested" || value === "promoted" || value === "none") {
    return value;
  }
  if (typeof promotionPackageId === "string" && promotionPackageId.trim().length > 0 && !Boolean(promoted)) {
    return "requested";
  }
  return Boolean(promoted) ? "promoted" : "none";
}

function mapProgram(id: string, data: DocumentData): ProgramRecord {
  const visibility = data.visibility === "private" || data.catalogVisibility === "professional_only"
    ? "private"
    : "public";
  const promotionStatus = toPromotionStatus(data.promotionStatus, data.promoted, data.promotionPackageId);

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
    availableFrom: null,
    expiresAt: null,
    status: data.status,
    facilitatorName: data.facilitatorName ?? null,
    promoted: Boolean(data.promoted),
    promotionPackageId: typeof data.promotionPackageId === "string" ? data.promotionPackageId : null,
    promotionStatus,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: data.listingStatus === "requested" || data.listingStatus === "approved" || data.listingStatus === "rejected"
      ? data.listingStatus
      : "none",
    visibility,
    ownershipScope: data.ownershipScope,
    ownerEntityId: data.ownerEntityId ?? null,
    catalogVisibility: data.catalogVisibility,
    publicationState: data.publicationState,
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
    archivedAt: null,
  };
}

function toEventPromotionStatus(value: unknown, promoted: unknown, promotionPackageId: unknown): EventPromotionStatus {
  if (value === "requested" || value === "promoted" || value === "none") {
    return value;
  }
  if (typeof promotionPackageId === "string" && promotionPackageId.trim().length > 0 && !Boolean(promoted)) {
    return "requested";
  }
  return Boolean(promoted) ? "promoted" : "none";
}

function mapEvent(id: string, data: DocumentData): EventRecord {
  const visibility = data.visibility === "private" || data.catalogVisibility === "professional_only"
    ? "private"
    : "public";
  const promotionStatus = toEventPromotionStatus(data.promotionStatus, data.promoted, data.promotionPackageId);

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
    eventDateTime: null,
    locationAddress: data.locationAddress ?? "",
    locationCity: data.locationCity ?? "",
    details: data.details ?? "",
    videoUrl: data.videoUrl ?? null,
    creditsRequired: data.creditsRequired ?? 0,
    cost: data.cost ?? 0,
    status: data.status ?? "draft",
    promoted: Boolean(data.promoted),
    promotionPackageId: typeof data.promotionPackageId === "string" ? data.promotionPackageId : null,
    promotionStatus,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: data.listingStatus === "requested" || data.listingStatus === "approved" || data.listingStatus === "rejected"
      ? data.listingStatus
      : "none",
    visibility,
    ownershipScope: data.ownershipScope ?? "platform",
    ownerEntityId: data.ownerEntityId ?? null,
    catalogVisibility: data.catalogVisibility ?? "tenant_wide",
    publicationState: data.publicationState ?? "draft",
    createdBy: data.createdBy ?? "",
    updatedBy: data.updatedBy ?? "",
    createdAt: null,
    updatedAt: null,
    publishedAt: null,
    archivedAt: null,
    cancelledAt: null,
  };
}

function toAssessmentPromotionStatus(
  value: unknown,
  promoted: unknown,
  promotionPackageId: unknown,
): AssessmentPromotionStatus {
  if (value === "requested" || value === "promoted" || value === "none") {
    return value;
  }
  if (typeof promotionPackageId === "string" && promotionPackageId.trim().length > 0 && !Boolean(promoted)) {
    return "requested";
  }
  return Boolean(promoted) ? "promoted" : "none";
}

function mapAssessment(id: string, data: DocumentData): AssessmentRecord {
  const visibility = data.visibility === "private" ? "private" : "public";
  const promotionStatus = toAssessmentPromotionStatus(data.promotionStatus, data.promoted, data.promotionPackageId);

  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    tenantIds: Array.isArray(data.tenantIds) ? data.tenantIds : undefined,
    name: String(data.name ?? ""),
    shortDescription: String(data.shortDescription ?? ""),
    longDescription: String(data.longDescription ?? ""),
    assessmentImageUrl: typeof data.assessmentImageUrl === "string" ? data.assessmentImageUrl : undefined,
    assessmentImagePath: typeof data.assessmentImagePath === "string" ? data.assessmentImagePath : undefined,
    assessmentContext: String(data.assessmentContext ?? ""),
    assessmentBenefit: String(data.assessmentBenefit ?? ""),
    assessmentType: data.assessmentType,
    renderStyle: data.renderStyle,
    reportStyle: data.reportStyle,
    creditsRequired: Number(data.creditsRequired ?? 0),
    questionBankCount: Number(data.questionBankCount ?? 0),
    questionsPerAttempt: Number(data.questionsPerAttempt ?? 0),
    analysisPrompt: String(data.analysisPrompt ?? ""),
    questionGenerationPrompt: String(data.questionGenerationPrompt ?? ""),
    status: data.status ?? "draft",
    promoted: Boolean(data.promoted),
    promotionPackageId: typeof data.promotionPackageId === "string" ? data.promotionPackageId : null,
    promotionStatus,
    listingPackageId: typeof data.listingPackageId === "string" ? data.listingPackageId : null,
    listingStatus: data.listingStatus === "requested" || data.listingStatus === "approved" || data.listingStatus === "rejected"
      ? data.listingStatus
      : "none",
    publicationState: data.publicationState ?? "unpublished",
    visibility,
    ownershipScope: data.ownershipScope ?? "tenant",
    ownerEntityId: String(data.ownerEntityId ?? ""),
    createdBy: String(data.createdBy ?? ""),
    updatedBy: String(data.updatedBy ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt ?? null,
  };
}

export async function listProgramPromotionRequests(tenantId?: string): Promise<ProgramRecord[]> {
  const snap = await getDocs(collection(db, "programs"));

  return snap.docs
    .map((row) => mapProgram(row.id, row.data()))
    .filter((program) => program.promotionStatus === "requested")
    .filter((program) => !tenantId || program.tenantId === tenantId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listEventPromotionRequests(tenantId?: string): Promise<EventRecord[]> {
  const snap = await getDocs(collection(db, "events"));

  return snap.docs
    .map((row) => mapEvent(row.id, row.data()))
    .filter((event) => event.promotionStatus === "requested")
    .filter((event) => !tenantId || event.tenantId === tenantId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listPromotionRequests(tenantId?: string): Promise<PromotionRequestRecord[]> {
  const [programRequests, eventRequests, assessmentRequests] = await Promise.all([
    listProgramPromotionRequests(tenantId),
    listEventPromotionRequests(tenantId),
    listAssessmentPromotionRequests(tenantId),
  ]);

  const rows: PromotionRequestRecord[] = [
    ...programRequests.map((program) => ({
      id: program.id,
      tenantId: program.tenantId,
      name: program.name,
      shortDescription: program.shortDescription,
      thumbnailUrl: program.thumbnailUrl,
      promotionPackageId: program.promotionPackageId,
      promotionStatus: program.promotionStatus,
      resourceType: "program" as const,
    })),
    ...eventRequests.map((event) => ({
      id: event.id,
      tenantId: event.tenantId,
      name: event.name,
      shortDescription: event.shortDescription,
      thumbnailUrl: event.thumbnailUrl,
      promotionPackageId: event.promotionPackageId,
      promotionStatus: event.promotionStatus,
      resourceType: "event" as const,
    })),
    ...assessmentRequests.map((assessment) => ({
      id: assessment.id,
      tenantId: assessment.tenantId,
      name: assessment.name,
      shortDescription: assessment.shortDescription,
      thumbnailUrl: assessment.assessmentImageUrl ?? null,
      promotionPackageId: assessment.promotionPackageId,
      promotionStatus: assessment.promotionStatus,
      resourceType: "assessment" as const,
    })),
  ];

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAssessmentPromotionRequests(tenantId?: string): Promise<AssessmentRecord[]> {
  const snap = await getDocs(collection(db, "assessments"));

  return snap.docs
    .map((row) => mapAssessment(row.id, row.data()))
    .filter((assessment) => assessment.promotionStatus === "requested")
    .filter((assessment) => !tenantId || assessment.tenantId === tenantId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function chargePromotionRequestOnSubmission(args: {
  resourceType: PromotionResourceType;
  resourceId: string;
  operatorId: string;
}): Promise<void> {
  let resourceDataForNotif: Record<string, unknown> | null = null;

  await runTransaction(db, async (transaction) => {
    const collectionName = getPromotionResourceCollection(args.resourceType);
    const resourceLabel = getPromotionResourceLabel(args.resourceType);
    const resourceRef = doc(db, collectionName, args.resourceId);
    const resourceSnap = await transaction.get(resourceRef);
    if (!resourceSnap.exists()) {
      throw new Error(`${resourceLabel} request no longer exists.`);
    }

    const resourceData = resourceSnap.data();
    const currentPromotionStatus = typeof resourceData.promotionStatus === "string"
      ? resourceData.promotionStatus
      : (Boolean(resourceData.promoted) ? "promoted" : "none");

    if (currentPromotionStatus !== "requested") {
      return;
    }

    const existingCharge = resourceData.promotionCharge as Record<string, unknown> | undefined;
    const alreadyCharged = Number(existingCharge?.creditsDeducted ?? 0) > 0;
    if (alreadyCharged) {
      return;
    }

    const promotionPackageId = typeof resourceData.promotionPackageId === "string" ? resourceData.promotionPackageId : "";
    if (!promotionPackageId) {
      throw new Error(`Promotion package is missing on this ${resourceLabel} request.`);
    }

    const promotionPackageRef = doc(db, "promotionPackages", promotionPackageId);
    const promotionPackageSnap = await transaction.get(promotionPackageRef);
    if (!promotionPackageSnap.exists()) {
      throw new Error("Selected promotion package was not found.");
    }

    const promotionPackageData = promotionPackageSnap.data() as Record<string, unknown>;
    const promotionCost = Number(promotionPackageData.costCredits ?? 0);
    const promotionPackageStatus = String(promotionPackageData.status ?? "inactive").trim();
    if (promotionPackageStatus !== "active") {
      throw new Error("Selected promotion package is inactive.");
    }
    if (!Number.isFinite(promotionCost) || promotionCost < 0) {
      throw new Error("Selected promotion package has invalid promotion cost.");
    }

    const requesterId = typeof resourceData.promotionRequestedBy === "string"
      ? resourceData.promotionRequestedBy
      : typeof resourceData.updatedBy === "string"
      ? resourceData.updatedBy
      : typeof resourceData.createdBy === "string"
      ? resourceData.createdBy
      : "";
    if (!requesterId) {
      throw new Error(`Could not determine requester wallet for this ${resourceLabel} promotion.`);
    }

    const tenantId = String(resourceData.tenantId ?? "");
    const requesterWallet = await getWalletByUserAndTenant({ userId: requesterId, tenantId });
    if (!requesterWallet) {
      throw new Error("Requester wallet not found.");
    }

    const walletRef = doc(db, "wallets", requesterWallet.id);
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists()) {
      throw new Error("Requester wallet not found.");
    }

    const walletData = walletSnap.data() as Record<string, unknown>;
    const availableCoins = Number(walletData.availableCoins ?? 0);
    const utilizedCoins = Number(walletData.utilizedCoins ?? 0);
    if (!Number.isFinite(availableCoins) || availableCoins < promotionCost) {
      throw new Error(`Requester does not have enough credits. Required: ${promotionCost}, Available: ${availableCoins}.`);
    }

    transaction.update(walletRef, {
      availableCoins: availableCoins - promotionCost,
      utilizedCoins: utilizedCoins + promotionCost,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });

    const walletTransactionRef = doc(collection(db, "walletTransactions"));
    transaction.set(walletTransactionRef, {
      walletId: requesterWallet.id,
      userId: requesterId,
      tenantId,
      userType: String(walletData.userType ?? "professional"),
      userName: String(walletData.userName ?? "User"),
      transactionType: "debit",
      source: "promotion",
      reason: `Promotion requested for ${resourceLabel} ${String(resourceData.name ?? args.resourceId)}`,
      coins: promotionCost,
      activityType: args.resourceType,
      activityId: args.resourceId,
      createdBy: args.operatorId,
      createdAt: serverTimestamp(),
    });

    transaction.update(resourceRef, {
      promotionCharge: {
        userId: requesterId,
        creditsDeducted: promotionCost,
        chargedAt: serverTimestamp(),
        chargedBy: args.operatorId,
      },
      promotionChargeTxId: walletTransactionRef.id,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });

    resourceDataForNotif = resourceData;
  });

  if (resourceDataForNotif && typeof resourceDataForNotif === "object") {
    try {
      const resourceType = args.resourceType;
      const resourceLabel = getPromotionResourceLabel(resourceType);
      const data = resourceDataForNotif as Record<string, unknown>;
      const resourceName = typeof data.name === "string" ? (data.name as string) : "Resource";
      const tenantIdForNotif = String(data.tenantId ?? "");
      const requesterIdForNotif = (
        typeof data.promotionRequestedBy === "string" ? (data.promotionRequestedBy as string)
        : typeof data.updatedBy === "string" ? (data.updatedBy as string)
        : typeof data.createdBy === "string" ? (data.createdBy as string)
        : ""
      );

      if (tenantIdForNotif && requesterIdForNotif) {
        await sendNotificationToUser({
          tenantId: tenantIdForNotif,
          userId: requesterIdForNotif,
          notificationType: "promotionRequested",
          templateVariables: {
            resourceType: resourceLabel,
            resourceName,
          },
          metadata: {
            resourceId: args.resourceId,
            resourceType,
          },
        });

        await sendAdminAlertToMasterSuperadmin({
          tenantId: tenantIdForNotif,
          notificationType: "adminPromotionAlert",
          templateVariables: {
            resourceType: resourceLabel,
            resourceName,
            requesterName: "User",
          },
          metadata: {
            resourceId: args.resourceId,
            resourceType,
          },
        });
      }
    } catch {
      // Promotion submission should not fail if notifications fail.
    }
  }
}

function addDurationFrom(startDate: Date, durationValue: number, durationUnit: "days" | "weeks" | "months"): Date {
  const result = new Date(startDate);

  if (durationUnit === "days") {
    result.setDate(result.getDate() + durationValue);
  } else if (durationUnit === "weeks") {
    result.setDate(result.getDate() + durationValue * 7);
  } else {
    result.setMonth(result.getMonth() + durationValue);
  }

  return result;
}

type PromotionResourceType = "program" | "event" | "assessment";

function getPromotionResourceCollection(resourceType: PromotionResourceType): "programs" | "events" | "assessments" {
  if (resourceType === "event") return "events";
  if (resourceType === "assessment") return "assessments";
  return "programs";
}

function getPromotionResourceLabel(resourceType: PromotionResourceType): string {
  if (resourceType === "event") return "Event";
  if (resourceType === "assessment") return "Assessment";
  return "Program";
}

export async function approveProgramPromotionRequest(args: {
  programId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
  let requesterIdForNotification = "";
  let tenantIdForNotification = "";
  let resourceNameForNotification = "";

  await runTransaction(db, async (transaction) => {
    const programRef = doc(db, "programs", args.programId);
    const programSnap = await transaction.get(programRef);
    if (!programSnap.exists()) {
      throw new Error("Program request no longer exists.");
    }

    const programData = programSnap.data();
    const currentPromotionStatus = typeof programData.promotionStatus === "string"
      ? programData.promotionStatus
      : (Boolean(programData.promoted) ? "promoted" : "none");
    if (currentPromotionStatus === "promoted") {
      throw new Error("Promotion request is already approved.");
    }

    const promotionPackageId = typeof programData.promotionPackageId === "string" ? programData.promotionPackageId : "";
    if (!promotionPackageId) {
      throw new Error("Promotion package is missing on this Program request.");
    }

    const promotionPackageRef = doc(db, "promotionPackages", promotionPackageId);
    const promotionPackageSnap = await transaction.get(promotionPackageRef);
    if (!promotionPackageSnap.exists()) {
      throw new Error("Selected promotion package was not found.");
    }

    const promotionPackageData = promotionPackageSnap.data() as Record<string, unknown>;
    const promotionPackage = {
      id: promotionPackageSnap.id,
      name: String(promotionPackageData.name ?? "").trim() || "Promotion Package",
      resourceType: String(promotionPackageData.resourceType ?? "program").trim() || "program",
      durationValue: Number(promotionPackageData.durationValue ?? 0),
      durationUnit: (String(promotionPackageData.durationUnit ?? "weeks").trim() || "weeks") as "days" | "weeks" | "months",
      costCredits: Number(promotionPackageData.costCredits ?? 0),
      status: String(promotionPackageData.status ?? "inactive").trim(),
    };

    if (promotionPackage.status !== "active") {
      throw new Error("Selected promotion package is inactive.");
    }

    if (!Number.isFinite(promotionPackage.costCredits) || promotionPackage.costCredits < 0) {
      throw new Error("Selected promotion package has invalid promotion cost.");
    }

    const existingCharge = programData.promotionCharge as Record<string, unknown> | undefined;
    const alreadyCharged = Number(existingCharge?.creditsDeducted ?? 0) > 0;

    const requesterId = typeof programData.promotionRequestedBy === "string"
      ? programData.promotionRequestedBy
      : typeof programData.updatedBy === "string"
      ? programData.updatedBy
      : typeof programData.createdBy === "string"
      ? programData.createdBy
      : "";

    requesterIdForNotification = requesterId;

    tenantIdForNotification = String(programData.tenantId ?? "");
    resourceNameForNotification = String(programData.name ?? "Program");

    if (!requesterId) {
      throw new Error("Could not determine requester wallet for this promotion.");
    }

    const tenantId = String(programData.tenantId ?? "");
    const requesterWallet = await getWalletByUserAndTenant({ userId: requesterId, tenantId });
    if (!requesterWallet) {
      throw new Error("Requester wallet not found.");
    }

    const walletRef = doc(db, "wallets", requesterWallet.id);
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists()) {
      throw new Error("Requester wallet not found.");
    }

    const walletData = walletSnap.data() as Record<string, unknown>;
    const availableCoins = Number(walletData.availableCoins ?? 0);
    const utilizedCoins = Number(walletData.utilizedCoins ?? 0);

    if (!alreadyCharged && (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits)) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

    if (!alreadyCharged) {
      transaction.update(walletRef, {
        availableCoins: availableCoins - promotionPackage.costCredits,
        utilizedCoins: utilizedCoins + promotionPackage.costCredits,
        updatedBy: args.operatorId,
        updatedAt: serverTimestamp(),
      });

      const walletTransactionRef = doc(collection(db, "walletTransactions"));
      transaction.set(walletTransactionRef, {
        walletId: requesterWallet.id,
        userId: requesterId,
        tenantId,
        userType: String(walletData.userType ?? "professional"),
        userName: String(walletData.userName ?? "User"),
        transactionType: "debit",
        source: "promotion",
        reason: `Promotion approved for Program ${String(programData.name ?? args.programId)}`,
        coins: promotionPackage.costCredits,
        activityType: "program",
        activityId: args.programId,
        createdBy: args.operatorId,
        createdAt: serverTimestamp(),
      });
    }

    transaction.update(programRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: alreadyCharged
        ? existingCharge
        : {
            userId: requesterId,
            creditsDeducted: promotionPackage.costCredits,
            chargedAt: promotionStartsAt,
            chargedBy: args.operatorId,
          },
      promotionAppliedPackage: {
        id: promotionPackage.id,
        name: promotionPackage.name,
        resourceType: promotionPackage.resourceType,
        durationValue: promotionPackage.durationValue,
        durationUnit: promotionPackage.durationUnit,
        costCredits: promotionPackage.costCredits,
      },
      promotionEndsAt,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantIdForNotification && requesterIdForNotification) {
    try {
      await sendNotificationToUser({
        tenantId: tenantIdForNotification,
        userId: requesterIdForNotification,
        notificationType: "promotionApproved",
        templateVariables: {
          resourceType: "Program",
          resourceName: resourceNameForNotification,
        },
        metadata: {
          resourceType: "program",
          resourceId: args.programId,
        },
      });
    } catch {
      // Approval should not fail if notification fails.
    }
  }
}

export async function approveEventPromotionRequest(args: {
  eventId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
  let requesterIdForNotification = "";
  let tenantIdForNotification = "";
  let resourceNameForNotification = "";

  await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, "events", args.eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("Event request no longer exists.");
    }

    const eventData = eventSnap.data();
    const currentPromotionStatus = typeof eventData.promotionStatus === "string"
      ? eventData.promotionStatus
      : (Boolean(eventData.promoted) ? "promoted" : "none");
    if (currentPromotionStatus === "promoted") {
      throw new Error("Promotion request is already approved.");
    }

    const promotionPackageId = typeof eventData.promotionPackageId === "string" ? eventData.promotionPackageId : "";
    if (!promotionPackageId) {
      throw new Error("Promotion package is missing on this Event request.");
    }

    const promotionPackageRef = doc(db, "promotionPackages", promotionPackageId);
    const promotionPackageSnap = await transaction.get(promotionPackageRef);
    if (!promotionPackageSnap.exists()) {
      throw new Error("Selected promotion package was not found.");
    }

    const promotionPackageData = promotionPackageSnap.data() as Record<string, unknown>;
    const promotionPackage = {
      id: promotionPackageSnap.id,
      name: String(promotionPackageData.name ?? "").trim() || "Promotion Package",
      resourceType: String(promotionPackageData.resourceType ?? "event").trim() || "event",
      durationValue: Number(promotionPackageData.durationValue ?? 0),
      durationUnit: (String(promotionPackageData.durationUnit ?? "weeks").trim() || "weeks") as "days" | "weeks" | "months",
      costCredits: Number(promotionPackageData.costCredits ?? 0),
      status: String(promotionPackageData.status ?? "inactive").trim(),
    };

    if (promotionPackage.status !== "active") {
      throw new Error("Selected promotion package is inactive.");
    }

    if (!Number.isFinite(promotionPackage.costCredits) || promotionPackage.costCredits <= 0) {
      throw new Error("Selected promotion package has invalid promotion cost.");
    }

    const existingCharge = eventData.promotionCharge as Record<string, unknown> | undefined;
    const alreadyCharged = Number(existingCharge?.creditsDeducted ?? 0) > 0;

    const requesterId = typeof eventData.promotionRequestedBy === "string"
      ? eventData.promotionRequestedBy
      : typeof eventData.updatedBy === "string"
      ? eventData.updatedBy
      : typeof eventData.createdBy === "string"
      ? eventData.createdBy
      : "";

    requesterIdForNotification = requesterId;

    tenantIdForNotification = String(eventData.tenantId ?? "");
    resourceNameForNotification = String(eventData.name ?? "Event");

    if (!requesterId) {
      throw new Error("Could not determine requester wallet for this promotion.");
    }

    const tenantId = String(eventData.tenantId ?? "");
    const requesterWallet = await getWalletByUserAndTenant({ userId: requesterId, tenantId });
    if (!requesterWallet) {
      throw new Error("Requester wallet not found.");
    }

    const walletRef = doc(db, "wallets", requesterWallet.id);
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists()) {
      throw new Error("Requester wallet not found.");
    }

    const walletData = walletSnap.data() as Record<string, unknown>;
    const availableCoins = Number(walletData.availableCoins ?? 0);
    const utilizedCoins = Number(walletData.utilizedCoins ?? 0);

    if (!alreadyCharged && (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits)) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

    if (!alreadyCharged) {
      transaction.update(walletRef, {
        availableCoins: availableCoins - promotionPackage.costCredits,
        utilizedCoins: utilizedCoins + promotionPackage.costCredits,
        updatedBy: args.operatorId,
        updatedAt: serverTimestamp(),
      });

      const walletTransactionRef = doc(collection(db, "walletTransactions"));
      transaction.set(walletTransactionRef, {
        walletId: requesterWallet.id,
        userId: requesterId,
        tenantId,
        userType: String(walletData.userType ?? "professional"),
        userName: String(walletData.userName ?? "User"),
        transactionType: "debit",
        source: "promotion",
        reason: `Promotion approved for Event ${String(eventData.name ?? args.eventId)}`,
        coins: promotionPackage.costCredits,
        activityType: "event",
        activityId: args.eventId,
        createdBy: args.operatorId,
        createdAt: serverTimestamp(),
      });
    }

    transaction.update(eventRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: alreadyCharged
        ? existingCharge
        : {
            userId: requesterId,
            creditsDeducted: promotionPackage.costCredits,
            chargedAt: promotionStartsAt,
            chargedBy: args.operatorId,
          },
      promotionAppliedPackage: {
        id: promotionPackage.id,
        name: promotionPackage.name,
        resourceType: promotionPackage.resourceType,
        durationValue: promotionPackage.durationValue,
        durationUnit: promotionPackage.durationUnit,
        costCredits: promotionPackage.costCredits,
      },
      promotionEndsAt,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantIdForNotification && requesterIdForNotification) {
    try {
      await sendNotificationToUser({
        tenantId: tenantIdForNotification,
        userId: requesterIdForNotification,
        notificationType: "promotionApproved",
        templateVariables: {
          resourceType: "Event",
          resourceName: resourceNameForNotification,
        },
        metadata: {
          resourceType: "event",
          resourceId: args.eventId,
        },
      });
    } catch {
      // Approval should not fail if notification fails.
    }
  }
}

export async function approveAssessmentPromotionRequest(args: {
  assessmentId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
  let requesterIdForNotification = "";
  let tenantIdForNotification = "";
  let resourceNameForNotification = "";

  await runTransaction(db, async (transaction) => {
    const assessmentRef = doc(db, "assessments", args.assessmentId);
    const assessmentSnap = await transaction.get(assessmentRef);
    if (!assessmentSnap.exists()) {
      throw new Error("Assessment request no longer exists.");
    }

    const assessmentData = assessmentSnap.data();
    const currentPromotionStatus = typeof assessmentData.promotionStatus === "string"
      ? assessmentData.promotionStatus
      : (Boolean(assessmentData.promoted) ? "promoted" : "none");
    if (currentPromotionStatus === "promoted") {
      throw new Error("Promotion request is already approved.");
    }

    const promotionPackageId = typeof assessmentData.promotionPackageId === "string" ? assessmentData.promotionPackageId : "";
    if (!promotionPackageId) {
      throw new Error("Promotion package is missing on this Assessment request.");
    }

    const promotionPackageRef = doc(db, "promotionPackages", promotionPackageId);
    const promotionPackageSnap = await transaction.get(promotionPackageRef);
    if (!promotionPackageSnap.exists()) {
      throw new Error("Selected promotion package was not found.");
    }

    const promotionPackageData = promotionPackageSnap.data() as Record<string, unknown>;
    const promotionPackage = {
      id: promotionPackageSnap.id,
      name: String(promotionPackageData.name ?? "").trim() || "Promotion Package",
      resourceType: String(promotionPackageData.resourceType ?? "assessment").trim() || "assessment",
      durationValue: Number(promotionPackageData.durationValue ?? 0),
      durationUnit: (String(promotionPackageData.durationUnit ?? "weeks").trim() || "weeks") as "days" | "weeks" | "months",
      costCredits: Number(promotionPackageData.costCredits ?? 0),
      status: String(promotionPackageData.status ?? "inactive").trim(),
    };

    if (promotionPackage.status !== "active") {
      throw new Error("Selected promotion package is inactive.");
    }

    if (!Number.isFinite(promotionPackage.costCredits) || promotionPackage.costCredits <= 0) {
      throw new Error("Selected promotion package has invalid promotion cost.");
    }

    const existingCharge = assessmentData.promotionCharge as Record<string, unknown> | undefined;
    const alreadyCharged = Number(existingCharge?.creditsDeducted ?? 0) > 0;

    const requesterId = typeof assessmentData.promotionRequestedBy === "string"
      ? assessmentData.promotionRequestedBy
      : typeof assessmentData.updatedBy === "string"
      ? assessmentData.updatedBy
      : typeof assessmentData.createdBy === "string"
      ? assessmentData.createdBy
      : "";

    requesterIdForNotification = requesterId;

    tenantIdForNotification = String(assessmentData.tenantId ?? "");
    resourceNameForNotification = String(assessmentData.name ?? "Assessment");

    if (!requesterId) {
      throw new Error("Could not determine requester wallet for this promotion.");
    }

    const tenantId = String(assessmentData.tenantId ?? "");
    const requesterWallet = await getWalletByUserAndTenant({ userId: requesterId, tenantId });
    if (!requesterWallet) {
      throw new Error("Requester wallet not found.");
    }

    const walletRef = doc(db, "wallets", requesterWallet.id);
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists()) {
      throw new Error("Requester wallet not found.");
    }

    const walletData = walletSnap.data() as Record<string, unknown>;
    const availableCoins = Number(walletData.availableCoins ?? 0);
    const utilizedCoins = Number(walletData.utilizedCoins ?? 0);

    if (!alreadyCharged && (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits)) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

    if (!alreadyCharged) {
      transaction.update(walletRef, {
        availableCoins: availableCoins - promotionPackage.costCredits,
        utilizedCoins: utilizedCoins + promotionPackage.costCredits,
        updatedBy: args.operatorId,
        updatedAt: serverTimestamp(),
      });

      const walletTransactionRef = doc(collection(db, "walletTransactions"));
      transaction.set(walletTransactionRef, {
        walletId: requesterWallet.id,
        userId: requesterId,
        tenantId,
        userType: String(walletData.userType ?? "professional"),
        userName: String(walletData.userName ?? "User"),
        transactionType: "debit",
        source: "promotion",
        reason: `Promotion approved for Assessment ${String(assessmentData.name ?? args.assessmentId)}`,
        coins: promotionPackage.costCredits,
        activityType: "assessment",
        activityId: args.assessmentId,
        createdBy: args.operatorId,
        createdAt: serverTimestamp(),
      });
    }

    transaction.update(assessmentRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: alreadyCharged
        ? existingCharge
        : {
            userId: requesterId,
            creditsDeducted: promotionPackage.costCredits,
            chargedAt: promotionStartsAt,
            chargedBy: args.operatorId,
          },
      promotionAppliedPackage: {
        id: promotionPackage.id,
        name: promotionPackage.name,
        resourceType: promotionPackage.resourceType,
        durationValue: promotionPackage.durationValue,
        durationUnit: promotionPackage.durationUnit,
        costCredits: promotionPackage.costCredits,
      },
      promotionEndsAt,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantIdForNotification && requesterIdForNotification) {
    try {
      await sendNotificationToUser({
        tenantId: tenantIdForNotification,
        userId: requesterIdForNotification,
        notificationType: "promotionApproved",
        templateVariables: {
          resourceType: "Assessment",
          resourceName: resourceNameForNotification,
        },
        metadata: {
          resourceType: "assessment",
          resourceId: args.assessmentId,
        },
      });
    } catch {
      // Approval should not fail if notification fails.
    }
  }
}

async function denyPromotionRequest(args: {
  resourceType: PromotionResourceType;
  resourceId: string;
  operatorId: string;
}): Promise<void> {
  let requesterIdForNotification = "";
  let tenantIdForNotification = "";
  let resourceNameForNotification = "";

  await runTransaction(db, async (transaction) => {
    const collectionName = getPromotionResourceCollection(args.resourceType);
    const resourceRef = doc(db, collectionName, args.resourceId);
    const resourceSnap = await transaction.get(resourceRef);
    if (!resourceSnap.exists()) {
      throw new Error("Promotion request no longer exists.");
    }

    const resourceData = resourceSnap.data();
    requesterIdForNotification = typeof resourceData.promotionRequestedBy === "string"
      ? resourceData.promotionRequestedBy
      : typeof resourceData.updatedBy === "string"
      ? resourceData.updatedBy
      : typeof resourceData.createdBy === "string"
      ? resourceData.createdBy
      : "";
    tenantIdForNotification = String(resourceData.tenantId ?? "");
    resourceNameForNotification = String(resourceData.name ?? args.resourceId);
    const charge = resourceData.promotionCharge as Record<string, unknown> | undefined;
    const chargeUserId = typeof charge?.userId === "string" ? charge.userId : "";
    const chargeCredits = Number(charge?.creditsDeducted ?? 0);
    const tenantId = String(resourceData.tenantId ?? "");

    let refundTxId: string | null = null;
    if (chargeUserId && Number.isFinite(chargeCredits) && chargeCredits > 0) {
      const requesterWallet = await getWalletByUserAndTenant({ userId: chargeUserId, tenantId });
      if (requesterWallet) {
        const walletRef = doc(db, "wallets", requesterWallet.id);
        const walletSnap = await transaction.get(walletRef);
        if (walletSnap.exists()) {
          const walletData = walletSnap.data() as Record<string, unknown>;
          const availableCoins = Number(walletData.availableCoins ?? 0);
          const utilizedCoins = Number(walletData.utilizedCoins ?? 0);
          const nextUtilized = Math.max(0, utilizedCoins - chargeCredits);

          transaction.update(walletRef, {
            availableCoins: availableCoins + chargeCredits,
            utilizedCoins: nextUtilized,
            updatedBy: args.operatorId,
            updatedAt: serverTimestamp(),
          });

          const walletTransactionRef = doc(collection(db, "walletTransactions"));
          refundTxId = walletTransactionRef.id;
          transaction.set(walletTransactionRef, {
            walletId: requesterWallet.id,
            userId: chargeUserId,
            tenantId,
            userType: String(walletData.userType ?? "professional"),
            userName: String(walletData.userName ?? "User"),
            transactionType: "credit",
            source: "promotion",
            reason: `Promotion request denied for ${getPromotionResourceLabel(args.resourceType)} ${String(resourceData.name ?? args.resourceId)}`,
            coins: chargeCredits,
            activityType: args.resourceType,
            activityId: args.resourceId,
            createdBy: args.operatorId,
            createdAt: serverTimestamp(),
          });
        }
      }
    }

    transaction.update(resourceRef, {
      promotionStatus: "none",
      promotionPackageId: null,
      promoted: false,
      promotionDeniedAt: serverTimestamp(),
      promotionDeniedBy: args.operatorId,
      promotionRefundTxId: refundTxId,
      promotionCharge: null,
      promotionChargeTxId: null,
      updatedBy: args.operatorId,
      updatedAt: serverTimestamp(),
    });
  });

  if (tenantIdForNotification && requesterIdForNotification) {
    try {
      await sendNotificationToUser({
        tenantId: tenantIdForNotification,
        userId: requesterIdForNotification,
        notificationType: "promotionDenied",
        templateVariables: {
          resourceType: getPromotionResourceLabel(args.resourceType),
          resourceName: resourceNameForNotification,
          reason: "Request denied by Super Admin",
        },
        metadata: {
          resourceType: args.resourceType,
          resourceId: args.resourceId,
        },
      });
    } catch {
      // Denial should not fail if notification fails.
    }
  }
}

export async function denyProgramPromotionRequest(args: {
  programId: string;
  operatorId: string;
}): Promise<void> {
  await denyPromotionRequest({
    resourceType: "program",
    resourceId: args.programId,
    operatorId: args.operatorId,
  });
}

export async function denyEventPromotionRequest(args: {
  eventId: string;
  operatorId: string;
}): Promise<void> {
  await denyPromotionRequest({
    resourceType: "event",
    resourceId: args.eventId,
    operatorId: args.operatorId,
  });
}

export async function denyAssessmentPromotionRequest(args: {
  assessmentId: string;
  operatorId: string;
}): Promise<void> {
  await denyPromotionRequest({
    resourceType: "assessment",
    resourceId: args.assessmentId,
    operatorId: args.operatorId,
  });
}
