import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { AssignmentStatus } from "@/types/assignment";
import {
  EMPTY_DEVELOPMENT_PLAN_SUMMARY,
  type DevelopmentRecommendationActorContext,
  type DevelopmentObjectivesProfileInput,
  type DevelopmentObjectivesProfileRecord,
  type DevelopmentObjectiveRecord,
  type DevelopmentPlanDraftInput,
  type DevelopmentDocumentType,
  type DevelopmentPlanItemRecord,
  type DevelopmentPlanListArgs,
  type DevelopmentPlanRecommendationRecord,
  type DevelopmentPlanRecord,
  type DevelopmentPlanSummary,
} from "@/types/development-plan";
import { listPrograms } from "@/services/programs.service";
import { listEvents } from "@/services/events.service";
import type { AssessmentRecord } from "@/types/assessment";
import type { EventRecord } from "@/types/event";
import type { ProgramRecord } from "@/types/program";

const COLLECTION = "developmentPlans";

type DevelopmentPlanAggregateDocument = {
  tenantId: string;
  creatorUserId: string;
  creatorName: string;
  creatorRole: DevelopmentPlanRecord["creatorRole"];
  subjectUserId: string;
  subjectName: string;
  subjectRole: DevelopmentPlanRecord["subjectRole"];
  editorUserIds: string[];
  objectiveStatus: DevelopmentPlanRecord["objectiveStatus"];
  objectives: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
  planIds: string[];
  createdAt?: DevelopmentPlanRecord["createdAt"];
  updatedAt?: DevelopmentPlanRecord["updatedAt"];
};

function getAggregateDocId(tenantId: string, subjectUserId: string): string {
  return `${tenantId.trim()}__${subjectUserId.trim()}`;
}

function normalizeObjectives(objectives: DevelopmentObjectiveRecord[]): Array<Record<string, unknown>> {
  return objectives.map((objective) => ({
    categoryId: objective.categoryId.trim(),
    categoryName: objective.categoryName.trim(),
    subCategoryId: objective.subCategoryId.trim(),
    subCategoryName: objective.subCategoryName.trim(),
    topicId: objective.topicId?.trim() || null,
    topicName: objective.topicName?.trim() || null,
    targetLevel: objective.targetLevel,
  }));
}

function mapObjectives(objectives: unknown): DevelopmentObjectiveRecord[] {
  return Array.isArray(objectives)
    ? (objectives as Record<string, unknown>[]).map((objective) => ({
        categoryId: toStringValue(objective.categoryId),
        categoryName: toStringValue(objective.categoryName),
        subCategoryId: toStringValue(objective.subCategoryId),
        subCategoryName: toStringValue(objective.subCategoryName),
        topicId: toStringValue(objective.topicId) || undefined,
        topicName: toStringValue(objective.topicName) || undefined,
        targetLevel: Math.min(5, Math.max(1, toNumberValue(objective.targetLevel) || 1)) as 1 | 2 | 3 | 4 | 5,
      }))
    : [];
}

function buildStoredPlan(args: {
  planId: string;
  input: DevelopmentPlanDraftInput;
  objectives: DevelopmentObjectiveRecord[];
}): Record<string, unknown> {
  const now = Timestamp.now();

  return {
    id: args.planId,
    planName: args.input.planName.trim(),
    priority: args.input.priority,
    startDate: args.input.startDate.trim(),
    endDate: args.input.endDate.trim(),
    status: "active",
    objectiveStatus: args.objectives.length > 0 ? "set" : "not_set",
    creatorUserId: args.input.creatorUserId.trim(),
    creatorName: args.input.creatorName.trim(),
    creatorRole: args.input.creatorRole,
    subjectUserId: args.input.subjectUserId.trim(),
    subjectName: args.input.subjectName.trim(),
    subjectRole: args.input.subjectRole,
    objectives: normalizeObjectives(args.objectives),
    items: [],
    summary: EMPTY_DEVELOPMENT_PLAN_SUMMARY,
    createdAt: now,
    updatedAt: now,
  };
}

function serializePlanItems(items: DevelopmentPlanItemRecord[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    activityType: item.activityType,
    activityId: item.activityId,
    activityTitle: item.activityTitle,
    ...(item.shortDescription ? { shortDescription: item.shortDescription } : {}),
    ...(item.details ? { details: item.details } : {}),
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.categoryId ? { categoryId: item.categoryId } : {}),
    ...(item.categoryName ? { categoryName: item.categoryName } : {}),
    ...(item.subCategoryId ? { subCategoryId: item.subCategoryId } : {}),
    ...(item.subCategoryName ? { subCategoryName: item.subCategoryName } : {}),
    ...(item.topicId ? { topicId: item.topicId } : {}),
    ...(item.topicName ? { topicName: item.topicName } : {}),
    ...(typeof item.competencyLevel === "number" ? { competencyLevel: item.competencyLevel } : {}),
    creditsRequired: item.creditsRequired,
    ...(item.deliveryType ? { deliveryType: item.deliveryType } : {}),
    ...(typeof item.durationValue === "number" ? { durationValue: item.durationValue } : {}),
    ...(item.durationUnit ? { durationUnit: item.durationUnit } : {}),
    ...(item.facilitatorName ? { facilitatorName: item.facilitatorName } : {}),
    ...(item.videoUrl ? { videoUrl: item.videoUrl } : {}),
    ...(item.eventType ? { eventType: item.eventType } : {}),
    ...(item.eventDate ? { eventDate: item.eventDate } : {}),
    ...(item.eventTime ? { eventTime: item.eventTime } : {}),
    ...(item.locationCity ? { locationCity: item.locationCity } : {}),
    ...(item.locationAddress ? { locationAddress: item.locationAddress } : {}),
    ...(typeof item.cost === "number" ? { cost: item.cost } : {}),
    ...(item.assessmentContext ? { assessmentContext: item.assessmentContext } : {}),
    ...(item.assessmentBenefit ? { assessmentBenefit: item.assessmentBenefit } : {}),
    ...(item.assessmentType ? { assessmentType: item.assessmentType } : {}),
    ...(item.completeByDate ? { completeByDate: item.completeByDate } : {}),
    selected: item.selected,
    ...(item.assignmentId ? { assignmentId: item.assignmentId } : {}),
    ...(item.assignmentStatus ? { assignmentStatus: item.assignmentStatus } : {}),
  }));
}

async function updatePlanInAggregate(args: {
  aggregateId: string;
  planId: string;
  items: DevelopmentPlanItemRecord[];
  summary: DevelopmentPlanSummary;
  status: DevelopmentPlanRecord["status"];
  finalizedAt?: unknown;
}): Promise<void> {
  const aggregate = await getAggregateDocumentById(args.aggregateId);
  if (!aggregate) {
    throw new Error("Development plan bundle not found.");
  }

  const now = Timestamp.now();
  const plans = Array.isArray(aggregate.data.plans) ? aggregate.data.plans : [];
  const nextPlans = plans.map((plan) =>
    toStringValue(plan.id) === args.planId
      ? {
          ...plan,
          status: args.status,
          items: serializePlanItems(args.items),
          summary: args.summary,
          ...(args.finalizedAt ? { finalizedAt: args.finalizedAt } : {}),
          updatedAt: now,
        }
      : plan
  );

  await setDoc(
    doc(db, COLLECTION, aggregate.id),
    {
      plans: nextPlans,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function getAggregateDocumentBySubject(args: {
  tenantId: string;
  subjectUserId: string;
}): Promise<{ id: string; data: DevelopmentPlanAggregateDocument } | null> {
  return getAggregateDocumentById(getAggregateDocId(args.tenantId, args.subjectUserId));
}

async function getAggregateDocumentById(aggregateId: string): Promise<{ id: string; data: DevelopmentPlanAggregateDocument } | null> {
  const snapshot = await getDoc(doc(db, COLLECTION, aggregateId.trim()));
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    data: snapshot.data() as DevelopmentPlanAggregateDocument,
  };
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function toOptionalStringValue(value: unknown): string | undefined {
  const normalized = toStringValue(value);
  return normalized || undefined;
}

function matchesTenantScope(args: {
  primaryTenantId: string;
  tenantIds?: string[];
  selectedTenantId: string;
}): boolean {
  if (args.primaryTenantId === args.selectedTenantId) {
    return true;
  }

  return Array.isArray(args.tenantIds) && args.tenantIds.includes(args.selectedTenantId);
}

type RecommendationCandidate = {
  activityType: DevelopmentPlanItemRecord["activityType"];
  activityId: string;
  activityTitle: string;
  shortDescription?: string;
  details?: string;
  imageUrl?: string;
  ownershipScope?: string;
  ownerEntityId?: string;
  createdBy?: string;
  categoryId?: string;
  categoryName?: string;
  subCategoryId?: string;
  subCategoryName?: string;
  topicIds: string[];
  competencyLevel?: number;
  creditsRequired: number;
  deliveryType?: string;
  durationValue?: number;
  durationUnit?: string;
  facilitatorName?: string;
  videoUrl?: string;
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
  locationCity?: string;
  locationAddress?: string;
  cost?: number;
  assessmentContext?: string;
  assessmentBenefit?: string;
  assessmentType?: string;
};

function mapProgramCandidate(program: ProgramRecord): RecommendationCandidate | null {
  if (program.visibility !== "public" || program.status !== "published") {
    return null;
  }

  return {
    activityType: "program",
    activityId: program.id,
    activityTitle: program.name,
    shortDescription: program.shortDescription,
    details: program.details || program.longDescription,
    imageUrl: program.thumbnailUrl ?? undefined,
    ownershipScope: program.ownershipScope,
    ownerEntityId: program.ownerEntityId ?? undefined,
    createdBy: program.createdBy,
    categoryId: program.categoryId ?? undefined,
    categoryName: program.categoryName ?? undefined,
    subCategoryId: program.subCategoryId ?? undefined,
    subCategoryName: program.subCategoryName ?? undefined,
    topicIds: Array.isArray(program.topicIds) ? program.topicIds : [],
    competencyLevel: program.competencyLevel,
    creditsRequired: toNumberValue(program.creditsRequired),
    deliveryType: program.deliveryType,
    durationValue: program.durationValue,
    durationUnit: program.durationUnit,
    facilitatorName: program.facilitatorName ?? undefined,
    videoUrl: program.videoUrl ?? undefined,
  };
}

function mapEventCandidate(event: EventRecord): RecommendationCandidate | null {
  if (event.visibility !== "public" || event.status !== "published") {
    return null;
  }

  return {
    activityType: "event",
    activityId: event.id,
    activityTitle: event.name,
    shortDescription: event.shortDescription,
    details: event.details || event.longDescription,
    imageUrl: event.thumbnailUrl ?? undefined,
    ownershipScope: event.ownershipScope,
    ownerEntityId: event.ownerEntityId ?? undefined,
    createdBy: event.createdBy,
    categoryId: event.categoryId ?? undefined,
    categoryName: event.categoryName ?? undefined,
    subCategoryId: event.subCategoryId ?? undefined,
    subCategoryName: event.subCategoryName ?? undefined,
    topicIds: Array.isArray(event.topicIds) ? event.topicIds : [],
    competencyLevel: event.competencyLevel,
    creditsRequired: toNumberValue(event.creditsRequired),
    eventType: event.eventType,
    eventDate: event.eventDate ?? undefined,
    eventTime: event.eventTime ?? undefined,
    locationCity: event.locationCity || undefined,
    locationAddress: event.locationAddress || undefined,
    cost: toNumberValue(event.cost),
    videoUrl: event.videoUrl ?? undefined,
  };
}

function mapAssessmentCandidate(assessment: AssessmentRecord): RecommendationCandidate | null {
  if (assessment.visibility !== "public" || assessment.status !== "published") {
    return null;
  }

  return {
    activityType: "assessment",
    activityId: assessment.id,
    activityTitle: assessment.name,
    shortDescription: assessment.shortDescription,
    details: assessment.longDescription,
    imageUrl: assessment.assessmentImageUrl,
    ownershipScope: assessment.ownershipScope,
    ownerEntityId: assessment.ownerEntityId ?? undefined,
    createdBy: assessment.createdBy,
    categoryId: toOptionalStringValue(assessment.categoryId),
    categoryName: toOptionalStringValue(assessment.categoryName),
    subCategoryId: toOptionalStringValue(assessment.subCategoryId),
    subCategoryName: toOptionalStringValue(assessment.subCategoryName),
    topicIds: Array.isArray(assessment.topicIds) ? assessment.topicIds : [],
    competencyLevel: assessment.competencyLevel,
    creditsRequired: toNumberValue(assessment.creditsRequired),
    assessmentContext: assessment.assessmentContext,
    assessmentBenefit: assessment.assessmentBenefit,
    assessmentType: assessment.assessmentType,
  };
}

function getObjectiveLabel(objective: DevelopmentObjectiveRecord): string {
  return objective.topicName || objective.subCategoryName || objective.categoryName;
}

function matchesValue(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim() && right.trim() && left.trim() === right.trim());
}

function matchesValueIgnoreCase(left?: string, right?: string): boolean {
  return Boolean(left && right && left.trim() && right.trim() && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function getMatchDetails(candidate: RecommendationCandidate, objective: DevelopmentObjectiveRecord): {
  matchType: DevelopmentPlanRecommendationRecord["matchType"];
  matchPercent: number;
} | null {
  const topicMatched = Boolean(objective.topicId && candidate.topicIds.includes(objective.topicId));
  const subCategoryMatched = topicMatched
    || matchesValue(candidate.subCategoryId, objective.subCategoryId)
    || matchesValueIgnoreCase(candidate.subCategoryName, objective.subCategoryName);
  const categoryMatched = subCategoryMatched
    || matchesValue(candidate.categoryId, objective.categoryId)
    || matchesValueIgnoreCase(candidate.categoryName, objective.categoryName);

  if (categoryMatched && subCategoryMatched && topicMatched) {
    return {
      matchType: "highlyRecommended",
      matchPercent: 100,
    };
  }

  if (categoryMatched && subCategoryMatched) {
    return {
      matchType: "competencyAndSkill",
      matchPercent: 80,
    };
  }

  if (categoryMatched) {
    return {
      matchType: "competency",
      matchPercent: 50,
    };
  }

  return null;
}

function getMatchScore(args: {
  matchPercent: number;
  targetLevel: number;
  competencyLevel?: number;
}): number {
  const base = args.matchPercent * 10;
  if (!args.competencyLevel) {
    return base;
  }

  return base + Math.max(0, 20 - Math.abs(args.targetLevel - args.competencyLevel) * 4);
}

function normalizePlanItem(item: DevelopmentPlanItemRecord): DevelopmentPlanItemRecord {
  return {
    id: item.id.trim(),
    activityType: item.activityType,
    activityId: item.activityId.trim(),
    activityTitle: item.activityTitle.trim(),
    shortDescription: item.shortDescription?.trim() || undefined,
    details: item.details?.trim() || undefined,
    imageUrl: item.imageUrl?.trim() || undefined,
    categoryId: item.categoryId?.trim() || undefined,
    categoryName: item.categoryName?.trim() || undefined,
    subCategoryId: item.subCategoryId?.trim() || undefined,
    subCategoryName: item.subCategoryName?.trim() || undefined,
    topicId: item.topicId?.trim() || undefined,
    topicName: item.topicName?.trim() || undefined,
    competencyLevel: item.competencyLevel,
    creditsRequired: toNumberValue(item.creditsRequired),
    deliveryType: item.deliveryType?.trim() || undefined,
    durationValue: typeof item.durationValue === "number" ? item.durationValue : undefined,
    durationUnit: item.durationUnit?.trim() || undefined,
    facilitatorName: item.facilitatorName?.trim() || undefined,
    videoUrl: item.videoUrl?.trim() || undefined,
    eventType: item.eventType?.trim() || undefined,
    eventDate: item.eventDate?.trim() || undefined,
    eventTime: item.eventTime?.trim() || undefined,
    locationCity: item.locationCity?.trim() || undefined,
    locationAddress: item.locationAddress?.trim() || undefined,
    cost: typeof item.cost === "number" ? item.cost : undefined,
    assessmentContext: item.assessmentContext?.trim() || undefined,
    assessmentBenefit: item.assessmentBenefit?.trim() || undefined,
    assessmentType: item.assessmentType?.trim() || undefined,
    completeByDate: item.completeByDate?.trim() || undefined,
    selected: item.selected !== false,
    assignmentId: item.assignmentId?.trim() || undefined,
    assignmentStatus: item.assignmentStatus,
  };
}

function toIdSet(values: string[]): Set<string> {
  return new Set(values.map((item) => item.trim()).filter(Boolean));
}

function canAccessRecommendationByOwnership(
  candidate: RecommendationCandidate,
  actorContext?: DevelopmentRecommendationActorContext,
): boolean {
  if (!actorContext || actorContext.role === "individual") {
    return true;
  }

  const companyIds = toIdSet(actorContext.companyIds);
  const professionalIds = toIdSet(actorContext.professionalIds);
  const coachIds = toIdSet(actorContext.coachIds);
  const scope = candidate.ownershipScope;
  const owner = candidate.ownerEntityId?.trim() ?? "";
  const creator = candidate.createdBy?.trim() ?? "";

  const isCompanyOwned = Boolean(owner) && companyIds.has(owner);
  const isProfessionalOwned = Boolean(owner) && professionalIds.has(owner);
  const isCoachOwned = Boolean(owner) && coachIds.has(owner);
  const isCreatedByCompany = Boolean(creator) && companyIds.has(creator);
  const isCreatedByProfessional = Boolean(creator) && professionalIds.has(creator);
  const isCreatedByCoach = Boolean(creator) && coachIds.has(creator);
  const isUnownedTenantResource = !owner && (scope === "tenant" || scope === "company");

  if (actorContext.role === "company") {
    if (scope === "platform" || isUnownedTenantResource) {
      return true;
    }
    if (scope === "company" || scope === "tenant") {
      return isCompanyOwned || isCreatedByCompany;
    }
    if (scope === "professional") {
      return isCoachOwned || isCreatedByCoach;
    }
    return isCompanyOwned || isCoachOwned || isCreatedByCompany || isCreatedByCoach;
  }

  if (scope === "platform" || isUnownedTenantResource) {
    return true;
  }
  if (scope === "professional") {
    return isProfessionalOwned || isCreatedByProfessional;
  }
  if (scope === "company" || scope === "tenant") {
    return isCompanyOwned || isCreatedByCompany;
  }
  return isProfessionalOwned || isCompanyOwned || isCreatedByProfessional || isCreatedByCompany;
}

function computeSummary(items: DevelopmentPlanItemRecord[]): DevelopmentPlanSummary {
  const todayIso = new Date().toISOString().slice(0, 10);
  const completedTasks = items.filter((item) => item.assignmentStatus === "completed").length;
  const pendingTasks = Math.max(0, items.length - completedTasks);
  const overdueTasks = items.filter(
    (item) =>
      Boolean(item.completeByDate)
      && item.completeByDate! < todayIso
      && item.assignmentStatus !== "completed"
      && item.assignmentStatus !== "cancelled"
  ).length;

  return {
    totalTasks: items.length,
    completedTasks,
    pendingTasks,
    overdueTasks,
  };
}

function computePlanStatus(items: DevelopmentPlanItemRecord[]): DevelopmentPlanRecord["status"] {
  if (items.length > 0 && items.every((item) => item.assignmentStatus === "completed")) {
    return "completed";
  }

  return "active";
}

function mapPlanFromAggregate(bundleId: string, data: Record<string, unknown>): DevelopmentPlanRecord {
  const items = Array.isArray(data.items)
    ? (data.items as Record<string, unknown>[]).map((item, index) => ({
        id: toStringValue(item.id) || `item-${index + 1}`,
        activityType: (toStringValue(item.activityType) || "program") as DevelopmentPlanItemRecord["activityType"],
        activityId: toStringValue(item.activityId),
        activityTitle: toStringValue(item.activityTitle),
        shortDescription: toStringValue(item.shortDescription) || undefined,
        details: toStringValue(item.details) || undefined,
        imageUrl: toStringValue(item.imageUrl) || undefined,
        categoryId: toStringValue(item.categoryId) || undefined,
        categoryName: toStringValue(item.categoryName) || undefined,
        subCategoryId: toStringValue(item.subCategoryId) || undefined,
        subCategoryName: toStringValue(item.subCategoryName) || undefined,
        topicId: toStringValue(item.topicId) || undefined,
        topicName: toStringValue(item.topicName) || undefined,
        competencyLevel: toNumberValue(item.competencyLevel) || undefined,
        creditsRequired: toNumberValue(item.creditsRequired),
        deliveryType: toStringValue(item.deliveryType) || undefined,
        durationValue: toNumberValue(item.durationValue) || undefined,
        durationUnit: toStringValue(item.durationUnit) || undefined,
        facilitatorName: toStringValue(item.facilitatorName) || undefined,
        videoUrl: toStringValue(item.videoUrl) || undefined,
        eventType: toStringValue(item.eventType) || undefined,
        eventDate: toStringValue(item.eventDate) || undefined,
        eventTime: toStringValue(item.eventTime) || undefined,
        locationCity: toStringValue(item.locationCity) || undefined,
        locationAddress: toStringValue(item.locationAddress) || undefined,
        cost: toNumberValue(item.cost) || undefined,
        assessmentContext: toStringValue(item.assessmentContext) || undefined,
        assessmentBenefit: toStringValue(item.assessmentBenefit) || undefined,
        assessmentType: toStringValue(item.assessmentType) || undefined,
        completeByDate: toStringValue(item.completeByDate) || undefined,
        selected: item.selected !== false,
        assignmentId: toStringValue(item.assignmentId) || undefined,
        assignmentStatus: toStringValue(item.assignmentStatus) as DevelopmentPlanItemRecord["assignmentStatus"],
      }))
    : [];

  const objectives = mapObjectives(data.objectives);

  const summaryInput = data.summary as Record<string, unknown> | undefined;
  const computed = computeSummary(items);

  return {
    id: toStringValue(data.id) || `${bundleId}::plan`,
    aggregateId: bundleId,
    documentType: undefined,
    tenantId: toStringValue(data.tenantId),
    planName: toStringValue(data.planName),
    priority: (toStringValue(data.priority) || "medium") as DevelopmentPlanRecord["priority"],
    startDate: toStringValue(data.startDate),
    endDate: toStringValue(data.endDate),
    status: (toStringValue(data.status) || "draft") as DevelopmentPlanRecord["status"],
    objectiveStatus: (toStringValue(data.objectiveStatus) || "not_set") as DevelopmentPlanRecord["objectiveStatus"],
    creatorUserId: toStringValue(data.creatorUserId),
    creatorName: toStringValue(data.creatorName),
    creatorRole: (toStringValue(data.creatorRole) || "individual") as DevelopmentPlanRecord["creatorRole"],
    subjectUserId: toStringValue(data.subjectUserId),
    subjectName: toStringValue(data.subjectName),
    subjectRole: (toStringValue(data.subjectRole) || "individual") as DevelopmentPlanRecord["subjectRole"],
    objectives,
    items,
    summary: summaryInput
      ? {
          totalTasks: toNumberValue(summaryInput.totalTasks),
          completedTasks: toNumberValue(summaryInput.completedTasks),
          pendingTasks: toNumberValue(summaryInput.pendingTasks),
          overdueTasks: toNumberValue(summaryInput.overdueTasks),
        }
      : computed,
    finalizedAt: data.finalizedAt as DevelopmentPlanRecord["finalizedAt"],
    createdAt: data.createdAt as DevelopmentPlanRecord["createdAt"],
    updatedAt: data.updatedAt as DevelopmentPlanRecord["updatedAt"],
  };
}

function mapObjectivesProfile(id: string, data: Record<string, unknown>): DevelopmentObjectivesProfileRecord {
  const objectives = mapObjectives(data.objectives);
  return {
    id,
    documentType: "objectivesProfile",
    tenantId: toStringValue(data.tenantId),
    creatorUserId: toStringValue(data.creatorUserId),
    creatorName: toStringValue(data.creatorName),
    creatorRole: (toStringValue(data.creatorRole) || "individual") as DevelopmentObjectivesProfileRecord["creatorRole"],
    subjectUserId: toStringValue(data.subjectUserId),
    subjectName: toStringValue(data.subjectName),
    subjectRole: (toStringValue(data.subjectRole) || "individual") as DevelopmentObjectivesProfileRecord["subjectRole"],
    objectives,
    objectiveStatus: (toStringValue(data.objectiveStatus) || "not_set") as DevelopmentObjectivesProfileRecord["objectiveStatus"],
    createdAt: data.createdAt as DevelopmentObjectivesProfileRecord["createdAt"],
    updatedAt: data.updatedAt as DevelopmentObjectivesProfileRecord["updatedAt"],
  };
}

export async function listDevelopmentPlansForUserContext(args: DevelopmentPlanListArgs): Promise<DevelopmentPlanRecord[]> {
  const tenantId = args.tenantId.trim();
  const userId = args.userId.trim();
  if (!tenantId || !userId) {
    return [];
  }

  const subjectUserIds = Array.from(
    new Set((args.subjectUserIds?.length ? args.subjectUserIds : [userId]).map((value) => value.trim()).filter(Boolean))
  );
  if (!subjectUserIds.length) {
    return [];
  }

  const aggregates = await Promise.all(
    subjectUserIds.map((subjectUserId) => getAggregateDocumentById(getAggregateDocId(tenantId, subjectUserId)))
  );

  const merged = new Map<string, DevelopmentPlanRecord>();
  aggregates.filter(Boolean).forEach((entry) => {
    const data = entry!.data as Record<string, unknown>;
    const plans = Array.isArray(data.plans) ? (data.plans as Record<string, unknown>[]) : [];
    plans.forEach((plan) => {
      const mapped = mapPlanFromAggregate(entry!.id, plan);
      merged.set(mapped.id, mapped);
    });
  });

  return [...merged.values()].sort((left, right) => {
    const leftTime = left.updatedAt?.toMillis?.() ?? 0;
    const rightTime = right.updatedAt?.toMillis?.() ?? 0;
    return rightTime - leftTime;
  });
}

export async function saveDevelopmentPlanDraft(input: DevelopmentPlanDraftInput): Promise<DevelopmentPlanRecord> {
  const planId = input.id?.trim() || doc(collection(db, COLLECTION)).id;
  const normalizedObjectives = input.objectives ?? [];
  const aggregateId = getAggregateDocId(input.tenantId, input.subjectUserId);
  const existing = await getAggregateDocumentBySubject({
    tenantId: input.tenantId,
    subjectUserId: input.subjectUserId,
  });
  const existingPlans = Array.isArray(existing?.data.plans) ? [...existing!.data.plans] : [];
  const nextPlan = buildStoredPlan({
    planId,
    input,
    objectives: normalizedObjectives,
  });
  const nextPlans = [nextPlan, ...existingPlans.filter((plan) => toStringValue(plan.id) !== planId)];

  await setDoc(
    doc(db, COLLECTION, aggregateId),
    {
      tenantId: input.tenantId.trim(),
      creatorUserId: existing?.data.creatorUserId ?? input.creatorUserId.trim(),
      creatorName: existing?.data.creatorName ?? input.creatorName.trim(),
      creatorRole: existing?.data.creatorRole ?? input.creatorRole,
      subjectUserId: input.subjectUserId.trim(),
      subjectName: input.subjectName.trim(),
      subjectRole: input.subjectRole,
      editorUserIds: arrayUnion(input.creatorUserId.trim()),
      objectives: existing?.data.objectives ?? normalizeObjectives(normalizedObjectives),
      objectiveStatus: toStringValue(existing?.data.objectiveStatus) || (normalizedObjectives.length > 0 ? "set" : "not_set"),
      plans: nextPlans,
      planIds: nextPlans.map((plan) => toStringValue(plan.id)).filter(Boolean),
      createdAt: existing?.data.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return mapPlanFromAggregate(aggregateId, nextPlan);
}

export async function getDevelopmentObjectivesProfile(args: {
  tenantId: string;
  creatorUserId: string;
  subjectUserId: string;
}): Promise<DevelopmentObjectivesProfileRecord | null> {
  const tenantId = args.tenantId.trim();
  const creatorUserId = args.creatorUserId.trim();
  const subjectUserId = args.subjectUserId.trim();

  if (!tenantId || !creatorUserId || !subjectUserId) {
    return null;
  }

  const row = await getAggregateDocumentBySubject({ tenantId, subjectUserId });
  if (!row) {
    return null;
  }

  return mapObjectivesProfile(row.id, row.data as unknown as Record<string, unknown>);
}

export async function saveDevelopmentObjectivesProfile(input: DevelopmentObjectivesProfileInput): Promise<DevelopmentObjectivesProfileRecord> {
  const profileId = getAggregateDocId(input.tenantId, input.subjectUserId);
  const objectives = normalizeObjectives(input.objectives);
  const existing = await getAggregateDocumentBySubject({
    tenantId: input.tenantId,
    subjectUserId: input.subjectUserId,
  });

  await setDoc(
    doc(db, COLLECTION, profileId),
    {
      tenantId: input.tenantId.trim(),
      creatorUserId: input.creatorUserId.trim(),
      creatorName: input.creatorName.trim(),
      creatorRole: input.creatorRole,
      subjectUserId: input.subjectUserId.trim(),
      subjectName: input.subjectName.trim(),
      subjectRole: input.subjectRole,
      editorUserIds: arrayUnion(input.creatorUserId.trim()),
      objectives,
      objectiveStatus: objectives.length > 0 ? "set" : "not_set",
      plans: existing?.data.plans ?? [],
      planIds: existing?.data.planIds ?? [],
      updatedAt: serverTimestamp(),
      createdAt: existing?.data.createdAt ?? serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: profileId,
    documentType: "objectivesProfile",
    tenantId: input.tenantId.trim(),
    creatorUserId: input.creatorUserId.trim(),
    creatorName: input.creatorName.trim(),
    creatorRole: input.creatorRole,
    subjectUserId: input.subjectUserId.trim(),
    subjectName: input.subjectName.trim(),
    subjectRole: input.subjectRole,
    objectives: mapObjectives(objectives),
    objectiveStatus: objectives.length > 0 ? "set" : "not_set",
  };
}

export async function saveDevelopmentPlanObjectives(args: {
  aggregateId: string;
  planId: string;
  objectives: DevelopmentObjectiveRecord[];
}): Promise<void> {
  const normalizedObjectives = normalizeObjectives(args.objectives);
  const aggregate = await getAggregateDocumentById(args.aggregateId);
  if (!aggregate) {
    throw new Error("Development plan bundle not found.");
  }

  await setDoc(
    doc(db, COLLECTION, aggregate.id),
    {
      objectives: normalizedObjectives,
      objectiveStatus: normalizedObjectives.length > 0 ? "set" : "not_set",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function listDevelopmentRecommendations(args: {
  tenantId: string;
  plan: Pick<DevelopmentPlanRecord, "objectives">;
  actorContext?: DevelopmentRecommendationActorContext;
}): Promise<DevelopmentPlanRecommendationRecord[]> {
  if (args.plan.objectives.length === 0) {
    return [];
  }

  const [programs, events, assessmentSnap] = await Promise.all([
    listPrograms(args.tenantId),
    listEvents(args.tenantId),
    getDocs(collection(db, "assessments")),
  ]);

  const assessments = assessmentSnap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<AssessmentRecord, "id">) }))
    .filter((item) =>
      matchesTenantScope({
        primaryTenantId: item.tenantId,
        tenantIds: item.tenantIds,
        selectedTenantId: args.tenantId,
      })
    );

  const candidates = [
    ...programs.map(mapProgramCandidate),
    ...events.map(mapEventCandidate),
    ...assessments.map(mapAssessmentCandidate),
  ]
    .filter((item): item is RecommendationCandidate => Boolean(item))
    .filter((item) => canAccessRecommendationByOwnership(item, args.actorContext));

  const bestMatches = new Map<string, DevelopmentPlanRecommendationRecord & { score: number }>();

  args.plan.objectives.forEach((objective) => {
    candidates.forEach((candidate) => {
      const matchDetails = getMatchDetails(candidate, objective);
      if (!matchDetails) {
        return;
      }

      const score = getMatchScore({
        matchPercent: matchDetails.matchPercent,
        targetLevel: objective.targetLevel,
        competencyLevel: candidate.competencyLevel,
      });
      const key = `${candidate.activityType}:${candidate.activityId}`;
      const existing = bestMatches.get(key);

      if (existing && existing.score >= score) {
        return;
      }

      bestMatches.set(key, {
        id: key,
        activityType: candidate.activityType,
        activityId: candidate.activityId,
        activityTitle: candidate.activityTitle,
        categoryId: candidate.categoryId,
        categoryName: candidate.categoryName,
        subCategoryId: candidate.subCategoryId,
        subCategoryName: candidate.subCategoryName,
        topicId: objective.topicId,
        topicName: objective.topicName,
        competencyLevel: candidate.competencyLevel,
        creditsRequired: candidate.creditsRequired,
        selected: false,
        matchType: matchDetails.matchType,
        matchPercent: matchDetails.matchPercent,
        matchedObjectiveLabel: getObjectiveLabel(objective),
        shortDescription: candidate.shortDescription,
        details: candidate.details,
        imageUrl: candidate.imageUrl,
        deliveryType: candidate.deliveryType,
        durationValue: candidate.durationValue,
        durationUnit: candidate.durationUnit,
        facilitatorName: candidate.facilitatorName,
        videoUrl: candidate.videoUrl,
        eventType: candidate.eventType,
        eventDate: candidate.eventDate,
        eventTime: candidate.eventTime,
        locationCity: candidate.locationCity,
        locationAddress: candidate.locationAddress,
        cost: candidate.cost,
        assessmentContext: candidate.assessmentContext,
        assessmentBenefit: candidate.assessmentBenefit,
        assessmentType: candidate.assessmentType,
        score,
      });
    });
  });

  return [...bestMatches.values()]
    .sort((left, right) => right.score - left.score || left.activityTitle.localeCompare(right.activityTitle))
    .map(({ score: _score, ...item }) => item);
}

export async function saveDevelopmentPlanItems(args: {
  aggregateId: string;
  planId: string;
  items: DevelopmentPlanItemRecord[];
}): Promise<DevelopmentPlanSummary> {
  const items = args.items.map(normalizePlanItem);
  const summary = computeSummary(items);
  const status = computePlanStatus(items);
  await updatePlanInAggregate({
    aggregateId: args.aggregateId,
    planId: args.planId,
    items,
    summary,
    status,
  });

  return summary;
}

export async function syncDevelopmentPlanItemAssignmentStatus(args: {
  tenantId: string;
  subjectUserId: string;
  assignmentId: string;
  assignmentStatus: AssignmentStatus;
}): Promise<void> {
  const tenantId = args.tenantId.trim();
  const subjectUserId = args.subjectUserId.trim();
  const assignmentId = args.assignmentId.trim();

  if (!tenantId || !subjectUserId || !assignmentId) {
    return;
  }

  const aggregate = await getAggregateDocumentById(getAggregateDocId(tenantId, subjectUserId));
  if (!aggregate) {
    return;
  }

  const now = Timestamp.now();
  let didChange = false;
  const plans = Array.isArray(aggregate.data.plans) ? aggregate.data.plans : [];
  const nextPlans = plans.map((plan) => {
    const rawItems = Array.isArray(plan.items) ? (plan.items as Record<string, unknown>[]) : [];
    let planChanged = false;

    const nextRawItems = rawItems.map((item) => {
      if (toStringValue(item.assignmentId) !== assignmentId) {
        return item;
      }

      planChanged = true;
      didChange = true;
      return {
        ...item,
        assignmentStatus: args.assignmentStatus,
      };
    });

    if (!planChanged) {
      return plan;
    }

    const normalizedItems = mapPlanFromAggregate(aggregate.id, {
      ...plan,
      items: nextRawItems,
      summary: undefined,
    }).items;

    return {
      ...plan,
      items: serializePlanItems(normalizedItems),
      summary: computeSummary(normalizedItems),
      status: computePlanStatus(normalizedItems),
      updatedAt: now,
    };
  });

  if (!didChange) {
    return;
  }

  await setDoc(
    doc(db, COLLECTION, aggregate.id),
    {
      plans: nextPlans,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function finalizeDevelopmentPlan(args: {
  aggregateId: string;
  planId: string;
  items: DevelopmentPlanItemRecord[];
}): Promise<DevelopmentPlanSummary> {
  const items = args.items.map(normalizePlanItem);
  const summary = computeSummary(items);
  const status = computePlanStatus(items);
  await updatePlanInAggregate({
    aggregateId: args.aggregateId,
    planId: args.planId,
    items,
    summary,
    status,
    finalizedAt: Timestamp.now(),
  });

  return summary;
}