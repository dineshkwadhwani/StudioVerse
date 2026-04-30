import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { type AssessmentPromotionStatus, type AssessmentRecord } from "@/types/assessment";
import { db } from "@/services/firebase";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
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

export async function approveProgramPromotionRequest(args: {
  programId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
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

    if (!Number.isFinite(promotionPackage.costCredits) || promotionPackage.costCredits <= 0) {
      throw new Error("Selected promotion package has invalid promotion cost.");
    }

    const requesterId = typeof programData.promotionRequestedBy === "string"
      ? programData.promotionRequestedBy
      : typeof programData.updatedBy === "string"
      ? programData.updatedBy
      : typeof programData.createdBy === "string"
      ? programData.createdBy
      : "";

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

    if (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

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

    transaction.update(programRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: {
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
}

export async function approveEventPromotionRequest(args: {
  eventId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
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

    const requesterId = typeof eventData.promotionRequestedBy === "string"
      ? eventData.promotionRequestedBy
      : typeof eventData.updatedBy === "string"
      ? eventData.updatedBy
      : typeof eventData.createdBy === "string"
      ? eventData.createdBy
      : "";

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

    if (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

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

    transaction.update(eventRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: {
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
}

export async function approveAssessmentPromotionRequest(args: {
  assessmentId: string;
  operatorId: string;
  promotionStartsAt?: Date;
}): Promise<void> {
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

    const requesterId = typeof assessmentData.promotionRequestedBy === "string"
      ? assessmentData.promotionRequestedBy
      : typeof assessmentData.updatedBy === "string"
      ? assessmentData.updatedBy
      : typeof assessmentData.createdBy === "string"
      ? assessmentData.createdBy
      : "";

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

    if (!Number.isFinite(availableCoins) || availableCoins < promotionPackage.costCredits) {
      throw new Error(
        `Requester does not have enough credits. Required: ${promotionPackage.costCredits}, Available: ${availableCoins}.`
      );
    }

    const promotionStartsAt = args.promotionStartsAt ?? new Date();
    const promotionEndsAt = addDurationFrom(promotionStartsAt, promotionPackage.durationValue, promotionPackage.durationUnit);

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

    transaction.update(assessmentRef, {
      promoted: true,
      promotionStatus: "promoted",
      promotionStartsAt,
      promotionApprovedAt: serverTimestamp(),
      promotionApprovedBy: args.operatorId,
      promotionCharge: {
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
}
