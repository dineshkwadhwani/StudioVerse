"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { listCategories, listSubCategories, listTopics } from "@/services/categories.service";
import {
  getUserById,
  listManagedUsersForCompany,
  listManagedUsersForProfessional,
  type ManagedUserRecord,
} from "@/services/manage-users.service";
import { getUserProfile } from "@/services/profile.service";
import {
  getDevelopmentObjectivesProfile,
  listDevelopmentRecommendations,
  listDevelopmentPlansForUserContext,
  saveDevelopmentPlanDraft,
  saveDevelopmentPlanItems,
  saveDevelopmentObjectivesProfile,
} from "@/services/development-plans.service";
import {
  searchAssessments,
  searchEvents,
  searchPrograms,
  type AssessmentSearchResult,
  type EventSearchResult,
  type ProgramSearchResult,
} from "@/services/search.service";
import { createAssignment } from "@/services/assignment.service";
import { getTenantCompetencyFrameworkDetails } from "@/services/tenant-competency.service";
import { debitWalletCredits, getWalletForUserContext } from "@/services/wallet.service";
import type { AssignmentStatus } from "@/types/assignment";
import type { CategoryRecord, SubCategoryRecord, TopicRecord } from "@/types/category";
import type { CompetencyLevelOption } from "@/types/competency";
import type { UserProfileRecord } from "@/types/profile";
import type { TenantConfig } from "@/types/tenant";
import TenantViewAllHeader from "@/modules/landing/components/ViewAllHeader";
import shellStyles from "@/modules/resources/pages/ManageResourcesPage.module.css";
import DetailModal, { type DetailItem } from "@/modules/activities/components/DetailModal";
import {
  EMPTY_DEVELOPMENT_PLAN_DRAFT,
  type DevelopmentActorRole,
  type DevelopmentObjectiveRecord,
  type DevelopmentObjectivesProfileRecord,
  type DevelopmentPlanItemRecord,
  type DevelopmentPlanPriority,
  type DevelopmentRecommendationActorContext,
  type DevelopmentPlanRecommendationRecord,
  type DevelopmentPlanRecord,
} from "@/types/development-plan";
import styles from "./DevelopmentPlansPage.module.css";

type Props = {
  tenantConfig: TenantConfig;
  showHeader?: boolean;
  embedded?: boolean;
};

type TabKey = "objectives" | "plan" | "track";

type DraftState = typeof EMPTY_DEVELOPMENT_PLAN_DRAFT;

type ViewerState = {
  userId: string;
  fullName: string;
  role: DevelopmentActorRole;
};

type SubjectIdentity = {
  id: string;
  userId: string;
  uid?: string;
  fullName: string;
  email: string;
  phoneE164: string;
  isPending?: boolean;
};

type ObjectiveRow = DevelopmentObjectiveRecord & { id: string };
type ResourceSearchType = "program" | "event" | "assessment";
type ManualActivityDraft = {
  activityTitle: string;
  details: string;
  completeByDate: string;
  assignmentStatus: AssignmentStatus;
};

const EMPTY_MANUAL_ACTIVITY_DRAFT: ManualActivityDraft = {
  activityTitle: "",
  details: "",
  completeByDate: "",
  assignmentStatus: "assigned",
};

function computePlanSummary(items: DevelopmentPlanItemRecord[]): DevelopmentPlanRecord["summary"] {
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

function formatDate(value: DevelopmentPlanRecord["updatedAt"]): string {
  if (!value) return "-";
  const date = typeof value.toDate === "function" ? value.toDate() : null;
  if (!date) return "-";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatPriority(value: DevelopmentPlanPriority): string {
  if (value === "high") return "High";
  if (value === "low") return "Low";
  return "Medium";
}

function normalizeRole(value: string | null): DevelopmentActorRole {
  return value === "company" || value === "professional" ? value : "individual";
}

function roleLabel(role: DevelopmentActorRole | null): string {
  if (role === "company") return "Company";
  if (role === "professional") return "Professional";
  if (role === "individual") return "Individual";
  return "-";
}

function getSubjectIdentifier(subject: Pick<SubjectIdentity, "uid" | "userId" | "id">): string {
  return subject.uid?.trim() || subject.userId.trim() || subject.id.trim();
}

function getDevelopmentSubjectIdentifier(
  subject: Pick<SubjectIdentity, "uid" | "userId" | "id">,
  viewerRole: DevelopmentActorRole | null | undefined,
): string {
  if (viewerRole === "company" || viewerRole === "professional") {
    return subject.id.trim() || subject.userId.trim() || subject.uid?.trim() || "";
  }

  return getSubjectIdentifier(subject);
}

function matchesSubjectIdentifier(subjectUserId: string, subject: Pick<SubjectIdentity, "uid" | "userId" | "id">): boolean {
  const normalized = subjectUserId.trim();
  return [subject.id, subject.userId, subject.uid].filter(Boolean).includes(normalized);
}

function toIdList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((item) => item?.trim() ?? "").filter(Boolean)));
}

function mapManagedUserToSubject(user: ManagedUserRecord): SubjectIdentity {
  return {
    id: user.id,
    userId: user.userId,
    uid: user.uid,
    fullName: user.fullName,
    email: user.email,
    phoneE164: user.phoneE164,
    isPending: user.isPending,
  };
}

function mapProfileToSubject(profile: UserProfileRecord, authUid: string): SubjectIdentity {
  return {
    id: profile.id,
    userId: profile.userId,
    uid: authUid,
    fullName: profile.fullName,
    email: profile.email,
    phoneE164: profile.phoneE164 || profile.phone,
  };
}

function createObjectiveRow(level: number): ObjectiveRow {
  return {
    id: `objective-${Math.random().toString(36).slice(2, 10)}`,
    categoryId: "",
    categoryName: "",
    subCategoryId: "",
    subCategoryName: "",
    topicId: "",
    topicName: "",
    targetLevel: Math.min(5, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5,
  };
}

function recommendationKey(item: Pick<DevelopmentPlanItemRecord, "activityType" | "activityId">): string {
  return `${item.activityType}:${item.activityId}`;
}

function isManualActivity(item: Pick<DevelopmentPlanItemRecord, "activityId">): boolean {
  return item.activityId.startsWith("manual:");
}

function formatActivityType(value: DevelopmentPlanItemRecord["activityType"]): string {
  if (typeof value === "string" && value === "program") {
    return "Program";
  }
  if (value === "event") return "Event";
  if (value === "assessment") return "Assessment";
  return "Program";
}

function formatPlanItemType(item: DevelopmentPlanItemRecord): string {
  return isManualActivity(item) ? "Manual Activity" : formatActivityType(item.activityType);
}

function formatAssignmentStatusLabel(status?: AssignmentStatus): string {
  if (!status) return "Assigned";
  if (status === "in_progress") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getCompletionPercent(summary: DevelopmentPlanRecord["summary"]): number {
  if (summary.totalTasks <= 0) {
    return 0;
  }

  return Math.round((summary.completedTasks / summary.totalTasks) * 100);
}

function getPlanStatus(items: DevelopmentPlanItemRecord[]): DevelopmentPlanRecord["status"] {
  if (items.length > 0 && items.every((item) => item.assignmentStatus === "completed")) {
    return "completed";
  }

  return "active";
}

function formatMatchType(value: DevelopmentPlanRecommendationRecord["matchType"]): string {
  if (value === "manual") return "Added manually";
  if (value === "highlyRecommended") return "Highly Recommended";
  if (value === "competencyAndSkill") return "Competency and Skill match";
  return "Competency Match";
}

function toManualRecommendation(item: DevelopmentPlanItemRecord): DevelopmentPlanRecommendationRecord {
  return {
    ...item,
    matchType: "manual",
    matchPercent: 0,
    matchedObjectiveLabel: "Added manually",
  };
}

function mapProgramSearchResult(program: ProgramSearchResult): DevelopmentPlanRecommendationRecord {
  return {
    id: `program:${program.id}`,
    activityType: "program",
    activityId: program.id,
    activityTitle: program.name,
    shortDescription: program.shortDescription,
    details: program.details || program.longDescription,
    imageUrl: program.thumbnailUrl ?? undefined,
    categoryId: program.categoryId ?? undefined,
    categoryName: program.categoryName ?? undefined,
    subCategoryId: program.subCategoryId ?? undefined,
    subCategoryName: program.subCategoryName ?? undefined,
    competencyLevel: program.competencyLevel,
    creditsRequired: Number(program.creditsRequired) || 0,
    deliveryType: program.deliveryType,
    durationValue: program.durationValue,
    durationUnit: program.durationUnit,
    facilitatorName: program.facilitatorName ?? undefined,
    videoUrl: program.videoUrl ?? undefined,
    selected: false,
    matchType: "manual",
    matchPercent: 0,
    matchedObjectiveLabel: "Added manually",
  };
}

function mapEventSearchResult(event: EventSearchResult): DevelopmentPlanRecommendationRecord {
  return {
    id: `event:${event.id}`,
    activityType: "event",
    activityId: event.id,
    activityTitle: event.name,
    shortDescription: event.shortDescription,
    details: event.details || event.longDescription,
    imageUrl: event.thumbnailUrl ?? undefined,
    categoryId: event.categoryId ?? undefined,
    categoryName: event.categoryName ?? undefined,
    subCategoryId: event.subCategoryId ?? undefined,
    subCategoryName: event.subCategoryName ?? undefined,
    competencyLevel: event.competencyLevel,
    creditsRequired: Number(event.creditsRequired) || 0,
    videoUrl: event.videoUrl ?? undefined,
    eventType: event.eventType,
    eventDate: event.eventDate ?? undefined,
    eventTime: event.eventTime ?? undefined,
    locationCity: event.locationCity || undefined,
    locationAddress: event.locationAddress || undefined,
    cost: Number(event.cost) || 0,
    selected: false,
    matchType: "manual",
    matchPercent: 0,
    matchedObjectiveLabel: "Added manually",
  };
}

function mapAssessmentSearchResult(assessment: AssessmentSearchResult): DevelopmentPlanRecommendationRecord {
  return {
    id: `assessment:${assessment.id}`,
    activityType: "assessment",
    activityId: assessment.id,
    activityTitle: assessment.name,
    shortDescription: assessment.shortDescription,
    details: assessment.longDescription,
    imageUrl: assessment.assessmentImageUrl,
    categoryId: assessment.categoryId ?? undefined,
    categoryName: assessment.categoryName ?? undefined,
    subCategoryId: assessment.subCategoryId ?? undefined,
    subCategoryName: assessment.subCategoryName ?? undefined,
    competencyLevel: assessment.competencyLevel,
    creditsRequired: Number(assessment.creditsRequired) || 0,
    assessmentContext: assessment.assessmentContext,
    assessmentBenefit: assessment.assessmentBenefit,
    assessmentType: assessment.assessmentType,
    selected: false,
    matchType: "manual",
    matchPercent: 0,
    matchedObjectiveLabel: "Added manually",
  };
}

function buildPlanItem(item: DevelopmentPlanItemRecord): DevelopmentPlanItemRecord {
  return {
    id: item.id,
    activityType: item.activityType,
    activityId: item.activityId,
    activityTitle: item.activityTitle,
    shortDescription: item.shortDescription,
    details: item.details,
    imageUrl: item.imageUrl,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    subCategoryId: item.subCategoryId,
    subCategoryName: item.subCategoryName,
    topicId: item.topicId,
    topicName: item.topicName,
    competencyLevel: item.competencyLevel,
    creditsRequired: item.creditsRequired,
    deliveryType: item.deliveryType,
    durationValue: item.durationValue,
    durationUnit: item.durationUnit,
    facilitatorName: item.facilitatorName,
    videoUrl: item.videoUrl,
    eventType: item.eventType,
    eventDate: item.eventDate,
    eventTime: item.eventTime,
    locationCity: item.locationCity,
    locationAddress: item.locationAddress,
    cost: item.cost,
    assessmentContext: item.assessmentContext,
    assessmentBenefit: item.assessmentBenefit,
    assessmentType: item.assessmentType,
    completeByDate: item.completeByDate,
    selected: true,
    assignmentId: item.assignmentId,
    assignmentStatus: item.assignmentStatus,
  };
}

function toDetailItem(item: DevelopmentPlanItemRecord): DetailItem {
  return {
    id: item.activityId,
    type: item.activityType === "assessment" ? "tool" : "program",
    title: item.activityTitle,
    image: item.imageUrl || "",
    description: item.shortDescription || item.details || item.activityTitle,
    details: item.details,
    creditsRequired: item.creditsRequired,
    cost: item.cost,
    deliveryType: item.deliveryType,
    durationValue: item.durationValue,
    durationUnit: item.durationUnit,
    facilitatorName: item.facilitatorName,
    videoUrl: item.videoUrl,
    eventType: item.eventType,
    eventDate: item.eventDate,
    eventTime: item.eventTime,
    locationCity: item.locationCity,
    locationAddress: item.locationAddress,
    assessmentContext: item.assessmentContext,
    assessmentBenefit: item.assessmentBenefit,
    assessmentType: item.assessmentType,
  };
}

function isOverdue(item: DevelopmentPlanItemRecord): boolean {
  const todayIso = new Date().toISOString().slice(0, 10);
  const completeByDate = item.completeByDate;
  if (!completeByDate) {
    return false;
  }

  return completeByDate < todayIso
    && item.assignmentStatus !== "completed"
    && item.assignmentStatus !== "cancelled";
}

export default function DevelopmentPlansPage({
  tenantConfig,
  showHeader = true,
  embedded = false,
}: Props) {
  const router = useRouter();
  const basePath = `/${tenantConfig.id}`;
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [viewerProfile, setViewerProfile] = useState<UserProfileRecord | null>(null);
  const [actorLookupIds, setActorLookupIds] = useState<string[]>([]);
  const [recommendationActorContext, setRecommendationActorContext] = useState<DevelopmentRecommendationActorContext | null>(null);
  const [managedSubjects, setManagedSubjects] = useState<SubjectIdentity[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [plans, setPlans] = useState<DevelopmentPlanRecord[]>([]);
  const [objectivesProfile, setObjectivesProfile] = useState<DevelopmentObjectivesProfileRecord | null>(null);
  const [draft, setDraft] = useState<DraftState>({
    ...EMPTY_DEVELOPMENT_PLAN_DRAFT,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
  });
  const [activeTab, setActiveTab] = useState<TabKey>("objectives");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedTrackPlanId, setSelectedTrackPlanId] = useState("");
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [objectiveRows, setObjectiveRows] = useState<ObjectiveRow[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryRecord[]>([]);
  const [topics, setTopics] = useState<TopicRecord[]>([]);
  const [competencyLevelOptions, setCompetencyLevelOptions] = useState<CompetencyLevelOption[]>([]);
  const [recommendations, setRecommendations] = useState<DevelopmentPlanRecommendationRecord[]>([]);
  const [savingObjectives, setSavingObjectives] = useState(false);
  const [savingPlanItems, setSavingPlanItems] = useState(false);
  const [finalizingPlan, setFinalizingPlan] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [loadingObjectivesProfile, setLoadingObjectivesProfile] = useState(false);
  const [loadingManagedSubjects, setLoadingManagedSubjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [manualSearchText, setManualSearchText] = useState("");
  const [includePrograms, setIncludePrograms] = useState(true);
  const [includeAssessments, setIncludeAssessments] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [searchingResources, setSearchingResources] = useState(false);
  const [searchResults, setSearchResults] = useState<DevelopmentPlanRecommendationRecord[]>([]);
  const [manualActivityModalOpen, setManualActivityModalOpen] = useState(false);
  const [manualActivityDraft, setManualActivityDraft] = useState<ManualActivityDraft>(EMPTY_MANUAL_ACTIVITY_DRAFT);
  const [planItemsDraft, setPlanItemsDraft] = useState<DevelopmentPlanItemRecord[]>([]);

  const selectedDraftSubject = useMemo(() => {
    if (!viewer || !viewerProfile) {
      return null;
    }

    if (viewer.role === "individual") {
      return mapProfileToSubject(viewerProfile, viewer.userId);
    }

    return managedSubjects.find((item) => item.id === selectedSubjectId) ?? managedSubjects[0] ?? null;
  }, [managedSubjects, selectedSubjectId, viewer, viewerProfile]);
  const subjectPlans = useMemo(() => {
    if (!selectedDraftSubject) {
      return viewer?.role === "individual" ? plans : [];
    }

    return plans.filter((plan) => matchesSubjectIdentifier(plan.subjectUserId, selectedDraftSubject));
  }, [plans, selectedDraftSubject, viewer?.role]);
  const activePlans = useMemo(
    () => subjectPlans.filter((plan) => plan.status === "active" || plan.status === "completed"),
    [subjectPlans]
  );
  const trackEnabled = activePlans.length > 0;
  const planTabEnabled = Boolean(objectivesProfile?.objectives.length);
  const selectedPlan = useMemo(
    () => subjectPlans.find((plan) => plan.id === selectedPlanId) ?? null,
    [selectedPlanId, subjectPlans]
  );
  const selectedTrackPlan = useMemo(
    () => activePlans.find((plan) => plan.id === selectedTrackPlanId) ?? null,
    [activePlans, selectedTrackPlanId]
  );
  const canEditSelectedPlan = Boolean(selectedPlan && viewer && selectedPlan.creatorUserId === viewer.userId);
  const planSummaryDraft = useMemo(
    () => computePlanSummary(planItemsDraft),
    [planItemsDraft]
  );
  const planStatusDraft = useMemo(
    () => getPlanStatus(planItemsDraft),
    [planItemsDraft]
  );
  const currentPlanItemKeys = useMemo(
    () => new Set(planItemsDraft.map((item) => recommendationKey(item))),
    [planItemsDraft]
  );
  const newPlanCharge = useMemo(() => {
    const freePlans = tenantConfig.developmentConfig?.freePlans ?? 0;
    const costPerPlanCredits = tenantConfig.developmentConfig?.costPerPlanCredits ?? 0;
    return subjectPlans.length >= freePlans ? costPerPlanCredits : 0;
  }, [subjectPlans.length, tenantConfig.developmentConfig]);
  const selectedPlanCredits = useMemo(
    () => planItemsDraft.reduce((total, item) => total + item.creditsRequired, 0),
    [planItemsDraft]
  );
  const selectedPlanCompletionPercent = useMemo(
    () => getCompletionPercent(planSummaryDraft),
    [planSummaryDraft]
  );
  const hasPendingPlanChanges = useMemo(() => {
    if (!selectedPlan) {
      return false;
    }

    return JSON.stringify(planItemsDraft) !== JSON.stringify(selectedPlan.items);
  }, [planItemsDraft, selectedPlan]);
  const selectedPlanSubject = useMemo(() => {
    if (!selectedPlan) {
      return null;
    }

    if (viewer && viewerProfile && matchesSubjectIdentifier(selectedPlan.subjectUserId, mapProfileToSubject(viewerProfile, viewer.userId))) {
      return mapProfileToSubject(viewerProfile, viewer.userId);
    }

    return managedSubjects.find((item) => matchesSubjectIdentifier(selectedPlan.subjectUserId, item)) ?? {
      id: selectedPlan.subjectUserId,
      userId: selectedPlan.subjectUserId,
      fullName: selectedPlan.subjectName,
      email: "",
      phoneE164: "",
    };
  }, [managedSubjects, selectedPlan, viewer, viewerProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setViewer(null);
        setViewerProfile(null);
        setActorLookupIds([]);
        setManagedSubjects([]);
        setSelectedSubjectId("");
        setPlans([]);
        setLoading(false);
        router.replace(basePath);
        return;
      }

      setLoading(true);
      setLoadingManagedSubjects(true);
      setError("");
      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId: tenantConfig.id,
          profileId: sessionStorage.getItem("cs_profile_id") ?? undefined,
          phoneE164: sessionStorage.getItem("cs_phone") ?? undefined,
        });

        if (!profile) {
          throw new Error("Unable to resolve your profile.");
        }

        const actorRecord = await getUserById(profile.userId || firebaseUser.uid);
        const resolvedRole = normalizeRole(actorRecord?.userType ?? profile.userType);

        const nextViewer: ViewerState = {
          userId: firebaseUser.uid,
          fullName: profile.fullName?.trim() || firebaseUser.displayName?.trim() || sessionStorage.getItem("cs_name") || "Member",
          role: resolvedRole,
        };

        setViewer(nextViewer);
        setViewerProfile(profile);
        const nextActorLookupIds = toIdList([
          firebaseUser.uid,
          profile.id,
          profile.userId,
          actorRecord?.id,
          actorRecord?.userId,
          actorRecord?.uid,
        ]);
        setActorLookupIds(nextActorLookupIds);

        if (resolvedRole === "company" && actorRecord) {
          const managed = await listManagedUsersForCompany({
            tenantId: tenantConfig.id,
            companyId: actorRecord.id,
          });
          const managedIndividuals = managed.filter((item) => item.userType === "individual").map(mapManagedUserToSubject);
          const coachLookupIds = toIdList(
            managed
              .filter((item) => item.userType === "professional")
              .flatMap((item) => [item.id, item.userId, item.uid])
          );
          setRecommendationActorContext({
            role: resolvedRole,
            companyIds: nextActorLookupIds,
            professionalIds: [firebaseUser.uid],
            coachIds: coachLookupIds,
          });
          setManagedSubjects(managedIndividuals);
          const rows = await listDevelopmentPlansForUserContext({
            tenantId: tenantConfig.id,
            userId: firebaseUser.uid,
            subjectUserIds: managedIndividuals.map((subject) => getDevelopmentSubjectIdentifier(subject, resolvedRole)),
          });
          setPlans(rows);
        } else if (resolvedRole === "professional" && actorRecord) {
          const managed = await listManagedUsersForProfessional({
            professionalId: actorRecord.id,
          });
          const managedIndividuals = managed.map(mapManagedUserToSubject);
          setRecommendationActorContext({
            role: resolvedRole,
            companyIds: toIdList([actorRecord.associatedCompanyId]),
            professionalIds: nextActorLookupIds,
            coachIds: [],
          });
          setManagedSubjects(managedIndividuals);
          const rows = await listDevelopmentPlansForUserContext({
            tenantId: tenantConfig.id,
            userId: firebaseUser.uid,
            subjectUserIds: managedIndividuals.map((subject) => getDevelopmentSubjectIdentifier(subject, resolvedRole)),
          });
          setPlans(rows);
        } else {
          setRecommendationActorContext({
            role: resolvedRole,
            companyIds: [],
            professionalIds: nextActorLookupIds,
            coachIds: [],
          });
          setManagedSubjects([]);
          const rows = await listDevelopmentPlansForUserContext({
            tenantId: tenantConfig.id,
            userId: firebaseUser.uid,
            subjectUserIds: [firebaseUser.uid],
          });
          setPlans(rows);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load development plans.";
        console.error("Development plans load failed", loadError);
        setError(`Development plans load failed: ${message}`);
      } finally {
        setLoadingManagedSubjects(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, router, tenantConfig.id]);

  useEffect(() => {
    if (viewer?.role === "individual") {
      setSelectedSubjectId("");
      return;
    }

    if (managedSubjects.length === 0) {
      setSelectedSubjectId("");
      return;
    }

    setSelectedSubjectId((current) =>
      managedSubjects.some((item) => item.id === current) ? current : managedSubjects[0].id
    );
  }, [managedSubjects, viewer?.role]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listCategories(),
      listSubCategories(),
      listTopics(),
      getTenantCompetencyFrameworkDetails(tenantConfig.id),
    ]).then(([allCategories, allSubCategories, allTopics, competencyDetails]) => {
      if (!active) return;
      setCategories(allCategories.filter((item) => item.tenantId === tenantConfig.id));
      setSubCategories(allSubCategories.filter((item) => item.tenantId === tenantConfig.id));
      setTopics(allTopics.filter((item) => item.tenantId === tenantConfig.id));
      setCompetencyLevelOptions(competencyDetails.options);
    }).catch(() => {
      if (active) {
        setCompetencyLevelOptions([
          { value: 1, label: "Level 1", description: "Level 1" },
          { value: 2, label: "Level 2", description: "Level 2" },
          { value: 3, label: "Level 3", description: "Level 3" },
          { value: 4, label: "Level 4", description: "Level 4" },
          { value: 5, label: "Level 5", description: "Level 5" },
        ]);
      }
    });

    return () => {
      active = false;
    };
  }, [tenantConfig.id]);

  useEffect(() => {
    if (!subjectPlans.length) {
      setSelectedPlanId("");
      setRecommendations([]);
      setPlanItemsDraft([]);
      return;
    }

    const preferred = subjectPlans.find((plan) => plan.id === selectedPlanId) ?? subjectPlans[0];
    setSelectedPlanId(preferred.id);
  }, [selectedPlanId, subjectPlans]);

  useEffect(() => {
    setShowRecommendations(false);
    setSearchModalOpen(false);
    setSearchResults([]);
    setPlanItemsDraft(selectedPlan?.items ?? []);
  }, [selectedPlanId]);

  useEffect(() => {
    if (!activePlans.length) {
      setSelectedTrackPlanId("");
      return;
    }

    const preferred = activePlans.find((plan) => plan.id === selectedTrackPlanId) ?? activePlans[0];
    setSelectedTrackPlanId(preferred.id);
  }, [activePlans, selectedTrackPlanId]);

  useEffect(() => {
    if (!viewer || !selectedDraftSubject) {
      setObjectivesProfile(null);
      setObjectiveRows([]);
      return;
    }

    let active = true;
    setLoadingObjectivesProfile(true);
    void getDevelopmentObjectivesProfile({
      tenantId: tenantConfig.id,
      creatorUserId: viewer.userId,
      subjectUserId: getDevelopmentSubjectIdentifier(selectedDraftSubject, viewer.role),
    }).then((profile) => {
      if (!active) return;
      setObjectivesProfile(profile);
      setObjectiveRows(
        profile?.objectives.length
          ? profile.objectives.map((objective, index) => ({
              ...objective,
              id: `objective-profile-${profile.id}-${index + 1}`,
            }))
          : []
      );
    }).catch((loadError) => {
      if (!active) return;
      setObjectivesProfile(null);
      setObjectiveRows([]);
      const message = loadError instanceof Error ? loadError.message : "Failed to load development objectives.";
      console.error("Development objectives load failed", loadError);
      setError(`Development objectives load failed: ${message}`);
    }).finally(() => {
      if (active) {
        setLoadingObjectivesProfile(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedDraftSubject, tenantConfig.id, viewer]);

  useEffect(() => {
    if (!selectedPlan || !showRecommendations || selectedPlan.objectiveStatus !== "set") {
      setRecommendations([]);
      return;
    }

    let active = true;
    setLoadingRecommendations(true);
    void listDevelopmentRecommendations({
      tenantId: tenantConfig.id,
      plan: selectedPlan,
      actorContext: recommendationActorContext ?? undefined,
    }).then((rows) => {
      if (!active) {
        return;
      }

      const savedItems = new Map(
        selectedPlan.items.map((item) => [recommendationKey(item), item])
      );

      const mappedRows = rows.map((item) => {
          const saved = savedItems.get(recommendationKey(item));
          return {
            ...item,
            selected: Boolean(saved),
            completeByDate: saved?.completeByDate,
          };
        });

      const missingSavedItems = selectedPlan.items
        .filter((item) => !mappedRows.some((candidate) => recommendationKey(candidate) === recommendationKey(item)))
        .map((item) => toManualRecommendation(item));

      setRecommendations([...mappedRows, ...missingSavedItems]);
    }).catch(() => {
      if (active) {
        setRecommendations([]);
      }
    }).finally(() => {
      if (active) {
        setLoadingRecommendations(false);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedPlan, showRecommendations, tenantConfig.id, recommendationActorContext]);

  useEffect(() => {
    if (!message && !error) {
      return;
    }

    const feedbackNode = feedbackRef.current;
    if (!feedbackNode) {
      return;
    }

    requestAnimationFrame(() => {
      feedbackNode.scrollIntoView({ behavior: "smooth", block: "start" });
      feedbackNode.focus();
    });
  }, [error, message]);

  async function handleCreatePlan(): Promise<void> {
    if (!viewer || !viewerProfile) {
      setError("Sign in to create a development plan.");
      return;
    }

    if (viewer.role !== "individual" && !selectedDraftSubject) {
      setError("Select a target individual before creating a development plan.");
      return;
    }

    if (!objectivesProfile || objectivesProfile.objectives.length === 0) {
      setError("Save Development Objectives before creating a plan.");
      return;
    }

    if (!draft.planName.trim()) {
      setError("Plan name is required.");
      return;
    }

    if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
      setError("Enter a valid start and end date.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const subject = selectedDraftSubject ?? mapProfileToSubject(viewerProfile, viewer.userId);

      if (newPlanCharge > 0) {
        const wallet = await getWalletForUserContext(
          actorLookupIds.length > 0 ? actorLookupIds : [viewer.userId, viewerProfile.id, viewerProfile.userId],
          tenantConfig.id,
        );

        if (!wallet) {
          throw new Error("Wallet not found for this tenant.");
        }

        if (wallet.availableCoins < newPlanCharge) {
          throw new Error(`Not enough credits to create this plan. Required: ${newPlanCharge}, Available: ${wallet.availableCoins}.`);
        }

        await debitWalletCredits({
          tenantId: tenantConfig.id,
          userId: viewer.userId,
          lookupUserIds: actorLookupIds,
          credits: newPlanCharge,
          reason: `Development plan access: ${draft.planName}`,
          source: "development-plan",
          createdBy: viewer.userId,
        });
      }

      const saved = await saveDevelopmentPlanDraft({
        tenantId: tenantConfig.id,
        planName: draft.planName,
        priority: draft.priority,
        startDate: draft.startDate,
        endDate: draft.endDate,
        creatorUserId: viewer.userId,
        creatorName: viewer.fullName,
        creatorRole: viewer.role,
        subjectUserId: getDevelopmentSubjectIdentifier(subject, viewer.role),
        subjectName: subject.fullName,
        subjectRole: "individual",
        objectives: objectivesProfile.objectives,
      });
      setPlans((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSelectedPlanId(saved.id);
      setShowNewPlanForm(false);
      setShowRecommendations(false);
      setActiveTab("plan");
      setMessage(`Plan "${saved.planName}" created for ${subject.fullName}.${newPlanCharge > 0 ? ` ${newPlanCharge} plan credits used.` : ""}`);
      setDraft((prev) => ({ ...prev, planName: "", priority: "medium" }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create the development plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveObjectives(): Promise<void> {
    if (!viewer || !selectedDraftSubject) {
      setError("Select a target individual before saving objectives.");
      return;
    }

    const normalizedObjectives = objectiveRows
      .filter((row) => row.categoryId && row.subCategoryId)
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        subCategoryId: row.subCategoryId,
        subCategoryName: row.subCategoryName,
        topicId: row.topicId || undefined,
        topicName: row.topicName || undefined,
        targetLevel: row.targetLevel,
      }));

    if (normalizedObjectives.length === 0) {
      setError("Add at least one objective row with category and skill.");
      return;
    }

    setSavingObjectives(true);
    setError("");
    setMessage("");
    try {
      const savedProfile = await saveDevelopmentObjectivesProfile({
        id: objectivesProfile?.id,
        tenantId: tenantConfig.id,
        creatorUserId: viewer.userId,
        creatorName: viewer.fullName,
        creatorRole: viewer.role,
        subjectUserId: getDevelopmentSubjectIdentifier(selectedDraftSubject, viewer.role),
        subjectName: selectedDraftSubject.fullName,
        subjectRole: "individual",
        objectives: normalizedObjectives,
      });
      setObjectivesProfile(savedProfile);
      setMessage(`Development objectives saved for ${selectedDraftSubject.fullName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save objectives.");
    } finally {
      setSavingObjectives(false);
    }
  }

  function updateObjectiveRow(rowId: string, patch: Partial<ObjectiveRow>): void {
    setObjectiveRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeObjectiveRow(rowId: string): void {
    setObjectiveRows((prev) => prev.filter((row) => row.id !== rowId));
  }

  async function persistPlanItems(nextItems: DevelopmentPlanItemRecord[], successMessage: string): Promise<boolean> {
    if (!selectedPlan || !viewer) {
      setError("Select a development plan first.");
      return false;
    }

    setSavingPlanItems(true);
    setError("");
    setMessage("");

    try {
      const summary = await saveDevelopmentPlanItems({
        aggregateId: selectedPlan.aggregateId ?? `${selectedPlan.tenantId}__${selectedPlan.subjectUserId}`,
        planId: selectedPlan.id,
        items: nextItems,
        actorUserId: viewer.userId,
      });

      const nextStatus = getPlanStatus(nextItems);
      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === selectedPlan.id
            ? {
                ...plan,
                status: nextStatus,
                items: nextItems,
                summary,
              }
            : plan
        )
      );
      setMessage(successMessage);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update the development plan.");
      return false;
    } finally {
      setSavingPlanItems(false);
    }
  }

  async function createAssignedPlanItem(item: DevelopmentPlanItemRecord): Promise<DevelopmentPlanItemRecord> {
    if (!selectedPlan || !viewer || !selectedPlanSubject) {
      throw new Error("Select a development plan before adding activities.");
    }

    const nameParts = selectedPlan.subjectName.trim().split(/\s+/);
    const assigneeFirstName = nameParts[0] ?? selectedPlan.subjectName;
    const assigneeLastName = nameParts.slice(1).join(" ");
    const result = await createAssignment({
      tenantId: tenantConfig.id,
      activityType: item.activityType,
      activityId: item.activityId,
      activityTitle: item.activityTitle,
      creditsRequired: item.creditsRequired,
      assigneeId: getSubjectIdentifier(selectedPlanSubject),
      assigneePhone: selectedPlanSubject.phoneE164 || "",
      assigneeEmail: selectedPlanSubject.email || "",
      assigneeFirstName,
      assigneeLastName,
      assigneeFullName: selectedPlan.subjectName,
      assignerId: viewer.userId,
      assignerName: viewer.fullName,
      assignerLookupIds: actorLookupIds,
      status: "assigned",
    });

    if (!result.success || !result.assignmentId) {
      throw new Error(result.message || `Failed to add ${item.activityTitle}.`);
    }

    return {
      ...buildPlanItem(item),
      assignmentId: result.assignmentId,
      assignmentStatus: "assigned",
    };
  }

  async function handleAddRecommendationToPlan(item: DevelopmentPlanRecommendationRecord): Promise<void> {
    if (!selectedPlan || !viewer) {
      setError("Select a development plan first.");
      return;
    }

    if (selectedPlan.creatorUserId !== viewer.userId) {
      setError("Only the plan creator can add activities.");
      return;
    }

    if (currentPlanItemKeys.has(recommendationKey(item))) {
      setMessage(`${item.activityTitle} is already part of this plan.`);
      return;
    }

    setError("");
    const nextItem = buildPlanItem({
      ...item,
      completeByDate: item.completeByDate || selectedPlan.endDate,
      selected: true,
    });

    setPlanItemsDraft((prev) => [...prev, nextItem]);
    setMessage(`${item.activityTitle} added to the current plan items. Save the plan to confirm.`);
  }

  async function handleRemovePlanItem(item: DevelopmentPlanItemRecord): Promise<void> {
    if (!selectedPlan || !viewer) {
      setError("Select a development plan first.");
      return;
    }

    if (selectedPlan.creatorUserId !== viewer.userId) {
      setError("Only the plan creator can remove activities.");
      return;
    }

    const confirmed = window.confirm("Remove this task from the plan? Credits already used for this task are not returned.");
    if (!confirmed) {
      return;
    }

    setPlanItemsDraft((prev) => prev.filter((entry) => entry.id !== item.id));
    setMessage(`${item.activityTitle} removed from the current plan items. Save the plan to confirm this change.`);
  }

  async function handleAddManualActivity(): Promise<void> {
    if (!selectedPlan || !viewer) {
      setError("Select a development plan first.");
      return;
    }

    if (selectedPlan.creatorUserId !== viewer.userId) {
      setError("Only the plan creator can add manual activities.");
      return;
    }

    if (!manualActivityDraft.activityTitle.trim()) {
      setError("Activity Name is required.");
      return;
    }

    if (!manualActivityDraft.details.trim()) {
      setError("Activity Details are required.");
      return;
    }

    if (!manualActivityDraft.completeByDate) {
      setError("Due Date is required.");
      return;
    }

    const manualId = `manual:${Date.now()}`;
    const nextItem: DevelopmentPlanItemRecord = {
      id: manualId,
      activityType: "program",
      activityId: manualId,
      activityTitle: manualActivityDraft.activityTitle.trim(),
      shortDescription: manualActivityDraft.details.trim(),
      details: manualActivityDraft.details.trim(),
      categoryName: "Manual Activity",
      creditsRequired: 0,
      completeByDate: manualActivityDraft.completeByDate,
      selected: true,
      assignmentStatus: manualActivityDraft.assignmentStatus,
    };

    setPlanItemsDraft((prev) => [...prev, nextItem]);
    setManualActivityModalOpen(false);
    setManualActivityDraft({
      ...EMPTY_MANUAL_ACTIVITY_DRAFT,
      completeByDate: selectedPlan.endDate,
    });
    setMessage(`${nextItem.activityTitle} added to the current plan items. Save the plan to confirm.`);
  }

  async function handleSavePlanDraftItems(): Promise<void> {
    if (!selectedPlan || !viewer || !viewerProfile) {
      setError("Select a development plan first.");
      return;
    }

    if (selectedPlan.creatorUserId !== viewer.userId) {
      setError("Only the plan creator can update this plan.");
      return;
    }

    const originalKeys = new Set(selectedPlan.items.map((item) => item.id));
    const addedItems = planItemsDraft.filter((item) => !originalKeys.has(item.id));
    const resourceItemsToAssign = addedItems.filter((item) => !isManualActivity(item) && !item.assignmentId);
    const totalCreditsToCharge = resourceItemsToAssign.reduce((total, item) => total + item.creditsRequired, 0);

    if (resourceItemsToAssign.some((item) => !item.completeByDate)) {
      setError("Every added resource activity must have a due date before saving.");
      return;
    }

    if (totalCreditsToCharge > 0) {
      const wallet = await getWalletForUserContext(
        actorLookupIds.length > 0 ? actorLookupIds : [viewer.userId, viewerProfile.id, viewerProfile.userId],
        tenantConfig.id,
      );

      if (!wallet) {
        setError("Wallet not found for this tenant.");
        return;
      }

      if (wallet.availableCoins < totalCreditsToCharge) {
        setError(`Not enough credits to save these activities. Required: ${totalCreditsToCharge}, Available: ${wallet.availableCoins}.`);
        return;
      }
    }

    const confirmed = window.confirm(
      [
        `Save ${selectedPlan.planName}?`,
        `Activities added: ${addedItems.length}`,
        `Total credits charged: ${totalCreditsToCharge}`,
        "These credits are not refundable if the task is removed from the plan.",
      ].join("\n")
    );

    if (!confirmed) {
      return;
    }

    setSavingPlanItems(true);
    setError("");
    setMessage("");

    try {
      const assignedItems = new Map<string, DevelopmentPlanItemRecord>();
      for (const item of resourceItemsToAssign) {
        const savedItem = await createAssignedPlanItem(item);
        assignedItems.set(item.id, savedItem);
      }

      const finalItems = planItemsDraft.map((item) => assignedItems.get(item.id) ?? item);
      const saved = await persistPlanItems(
        finalItems,
        `${addedItems.length} activities added to the plan. Total credits charged = ${totalCreditsToCharge}. These credits are not refundable if the task is removed from the plan.`
      );

      if (saved) {
        setPlanItemsDraft(finalItems);
      }
    } finally {
      setSavingPlanItems(false);
    }
  }

  function handleCancelPlanEditing(): void {
    setPlanItemsDraft(selectedPlan?.items ?? []);
    setShowRecommendations(false);
    setSearchModalOpen(false);
    setSelectedPlanId("");
    setMessage("");
    setError("");
  }

  function handleLaunchTask(item: DevelopmentPlanItemRecord): void {
    if (isManualActivity(item) || !item.assignmentId) {
      setSelectedDetailItem(toDetailItem(item));
      return;
    }

    const basePath = `/${tenantConfig.id}`;

    if (item.activityType === "assessment" && item.assignmentId) {
      router.push(`${basePath}/my-activities/assessment-launch/${item.assignmentId}`);
      return;
    }

    router.push(`${basePath}/my-activities`);
  }

  async function handleResourceSearch(options?: {
    query?: string;
    includePrograms?: boolean;
    includeAssessments?: boolean;
    includeEvents?: boolean;
  }): Promise<void> {
    const nextIncludePrograms = options?.includePrograms ?? includePrograms;
    const nextIncludeAssessments = options?.includeAssessments ?? includeAssessments;
    const nextIncludeEvents = options?.includeEvents ?? includeEvents;
    const trimmed = (options?.query ?? searchText).trim();
    if (trimmed.length < 2) {
      setError("Enter at least 2 characters to search resources.");
      return;
    }

    if (!nextIncludePrograms && !nextIncludeAssessments && !nextIncludeEvents) {
      setError("Select at least one resource type to search.");
      return;
    }

    setSearchingResources(true);
    setError("");
    try {
      const results: DevelopmentPlanRecommendationRecord[] = [];
      const tasks: Promise<void>[] = [];
      if (nextIncludePrograms) {
        tasks.push(searchPrograms({ tenantId: tenantConfig.id, queryString: trimmed }).then((rows) => {
          results.push(...rows.map(mapProgramSearchResult));
        }));
      }
      if (nextIncludeAssessments) {
        tasks.push(searchAssessments({ tenantId: tenantConfig.id, queryString: trimmed }).then((rows) => {
          results.push(...rows.map(mapAssessmentSearchResult));
        }));
      }
      if (nextIncludeEvents) {
        tasks.push(searchEvents({ tenantId: tenantConfig.id, queryString: trimmed }).then((rows) => {
          results.push(...rows.map(mapEventSearchResult));
        }));
      }
      await Promise.all(tasks);
      results.sort((left, right) => left.activityTitle.localeCompare(right.activityTitle));
      setSearchResults(results);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Failed to search resources.");
    } finally {
      setSearchingResources(false);
    }
  }

  async function handleManualResourceSearch(): Promise<void> {
    await handleResourceSearch({
      query: manualSearchText,
      includePrograms: true,
      includeAssessments: true,
      includeEvents: true,
    });
  }

  function handleAddSearchResultToPlan(item: DevelopmentPlanRecommendationRecord): void {
    void handleAddRecommendationToPlan(item);
  }

  return (
    <>
      <div className={embedded ? styles.embeddedRoot : shellStyles.wrapper}>
      {showHeader ? (
        <TenantViewAllHeader config={tenantConfig} currentPage="tools" onSignInRegister={() => undefined} />
      ) : null}

      <div className={shellStyles.shell}>
        <section className={shellStyles.heroCard}>
          <p className={styles.eyebrow}>Development</p>
          <h1 className={shellStyles.title}>Development Plan</h1>
          <p className={shellStyles.subtitle}>
            Define objectives, review matched programs, events, and assessments, and prepare the plan
            selection before finalization and tracking.
          </p>

          <div className={shellStyles.tabBar}>
            <button type="button" className={activeTab === "objectives" ? `${shellStyles.tab} ${shellStyles.active}` : shellStyles.tab} onClick={() => setActiveTab("objectives")}>Development Objectives</button>
            <button type="button" disabled={!planTabEnabled} className={activeTab === "plan" ? `${shellStyles.tab} ${shellStyles.active}` : shellStyles.tab} onClick={() => setActiveTab("plan")}>Development Plan</button>
            <button type="button" disabled={!trackEnabled} className={activeTab === "track" ? `${shellStyles.tab} ${shellStyles.active}` : shellStyles.tab} onClick={() => setActiveTab("track")}>Track Plan</button>
          </div>
        </section>

        <section className={shellStyles.contentCard}>
          <div className={styles.page}>
        <div ref={feedbackRef} tabIndex={-1} className={styles.feedbackAnchor}>
          {message ? <p className={styles.success}>{message}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>

        {activeTab === "objectives" ? (
          <div className={styles.objectivesBlock}>
            {viewer?.role !== "individual" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Target Individual</span>
                <select
                  className={styles.input}
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  disabled={loadingManagedSubjects || managedSubjects.length === 0}
                >
                  <option value="">Select target individual</option>
                  {managedSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.fullName}{subject.isPending ? " (Pending invite)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {viewer?.role !== "individual" && !loadingManagedSubjects && managedSubjects.length === 0 ? (
              <p className={styles.info}>No managed individuals are available for this account yet.</p>
            ) : null}

            <div className={styles.objectivesHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Development Objectives</h2>
                <p className={styles.helperText}>
                  {selectedDraftSubject
                    ? `Set development goals for ${selectedDraftSubject.fullName}. These goals stay independent of any individual plan.`
                    : "Select a target individual to define development goals."}
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setObjectiveRows((prev) => [...prev, createObjectiveRow(competencyLevelOptions[0]?.value ?? 1)])}
                disabled={!selectedDraftSubject}
              >
                Add Objective
              </button>
            </div>

            {loadingObjectivesProfile ? <p className={styles.info}>Loading development objectives...</p> : null}

            {objectiveRows.length === 0 ? (
              <div className={styles.note}>Click Add Objective to create the first development goal.</div>
            ) : (
              <div className={styles.objectiveList}>
                {objectiveRows.map((row) => {
                  const availableSubCategories = subCategories.filter((item) => item.categoryId === row.categoryId);
                  const availableTopics = topics.filter((item) => item.subCategoryId === row.subCategoryId);
                  return (
                    <div key={row.id} className={styles.objectiveCard}>
                      <div className={styles.objectiveGrid}>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Competency</span>
                          <select
                            className={styles.input}
                            value={row.categoryId}
                            onChange={(event) => {
                              const nextId = event.target.value;
                              const nextCategory = categories.find((item) => item.id === nextId);
                              updateObjectiveRow(row.id, {
                                categoryId: nextId,
                                categoryName: nextCategory?.name ?? "",
                                subCategoryId: "",
                                subCategoryName: "",
                                topicId: "",
                                topicName: "",
                              });
                            }}
                          >
                            <option value="">Select competency</option>
                            {categories.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Skill</span>
                          <select
                            className={styles.input}
                            value={row.subCategoryId}
                            onChange={(event) => {
                              const nextId = event.target.value;
                              const nextSubCategory = availableSubCategories.find((item) => item.id === nextId);
                              updateObjectiveRow(row.id, {
                                subCategoryId: nextId,
                                subCategoryName: nextSubCategory?.name ?? "",
                                topicId: "",
                                topicName: "",
                              });
                            }}
                          >
                            <option value="">Select skill</option>
                            {availableSubCategories.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Topic</span>
                          <select
                            className={styles.input}
                            value={row.topicId ?? ""}
                            onChange={(event) => {
                              const nextId = event.target.value;
                              const nextTopic = availableTopics.find((item) => item.id === nextId);
                              updateObjectiveRow(row.id, {
                                topicId: nextId,
                                topicName: nextTopic?.name ?? "",
                              });
                            }}
                          >
                            <option value="">Optional topic</option>
                            {availableTopics.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Competency Target Level</span>
                          <select
                            className={styles.input}
                            value={row.targetLevel}
                            onChange={(event) => updateObjectiveRow(row.id, { targetLevel: Number(event.target.value) as ObjectiveRow["targetLevel"] })}
                          >
                            {competencyLevelOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className={styles.objectiveActions}>
                        <button type="button" className={styles.ghostButton} onClick={() => removeObjectiveRow(row.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.legendCard}>
              <h3 className={styles.legendTitle}>Competency Legend</h3>
              <div className={styles.legendList}>
                {competencyLevelOptions.map((option) => (
                  <div key={option.value} className={styles.legendItem}>
                    <span className={styles.legendBadge}>{option.value}</span>
                    <div>
                      <p className={styles.legendLabel}>{option.label}</p>
                      <p className={styles.legendDescription}>{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.actionsRow}>
              <button type="button" className={styles.primaryButton} onClick={() => void handleSaveObjectives()} disabled={savingObjectives || !selectedDraftSubject}>
                {savingObjectives ? "Saving..." : "Save Development Objectives"}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "plan" ? (
          <div className={styles.planWorkspace}>
            {viewer?.role !== "individual" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Target Individual</span>
                <select
                  className={styles.input}
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  disabled={loadingManagedSubjects || managedSubjects.length === 0}
                >
                  <option value="">Select target individual</option>
                  {managedSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.fullName}{subject.isPending ? " (Pending invite)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {!objectivesProfile || objectivesProfile.objectiveStatus !== "set" ? (
              <div className={styles.note}>Save Development Objectives first. New plans are created from those saved goals.</div>
            ) : (
              <>
                <div className={styles.planListHeader}>
                  <div>
                    <h2 className={styles.sectionTitle}>Development Plans</h2>
                    <p className={styles.helperText}>Select a plan pill to open it. Use the last pill to create a new plan from the saved development objectives.</p>
                  </div>
                </div>

                <div className={styles.planNameList}>
                  {subjectPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={selectedPlanId === plan.id ? `${styles.planNameButton} ${styles.planNameButtonActive}` : styles.planNameButton}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setShowNewPlanForm(false);
                      }}
                    >
                      {plan.planName}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.planNameButton} ${styles.addPlanPill}`}
                    onClick={() => {
                      setShowNewPlanForm(true);
                      setSelectedPlanId("");
                    }}
                  >
                    Add New Plan
                  </button>
                </div>

                {showNewPlanForm ? (
                  <div className={styles.card}>
                    <h3 className={styles.sectionTitle}>New Plan</h3>
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Plan Name</span>
                        <input className={styles.input} value={draft.planName} onChange={(event) => setDraft((prev) => ({ ...prev, planName: event.target.value }))} placeholder="Leadership Growth Plan" />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Priority</span>
                        <select className={styles.input} value={draft.priority} onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value as DevelopmentPlanPriority }))}>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Start Date</span>
                        <input className={styles.input} type="date" value={draft.startDate} onChange={(event) => setDraft((prev) => ({ ...prev, startDate: event.target.value }))} />
                      </label>
                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>End Date</span>
                        <input className={styles.input} type="date" value={draft.endDate} onChange={(event) => setDraft((prev) => ({ ...prev, endDate: event.target.value }))} />
                      </label>
                    </div>
                    <div className={styles.actionsRow}>
                      <p className={styles.helperText}>
                        {newPlanCharge > 0
                          ? `Creating this plan uses ${newPlanCharge} plan credits.`
                          : "This plan is within the current free plan allowance."}
                      </p>
                      <button type="button" className={styles.primaryButton} onClick={() => void handleCreatePlan()} disabled={saving || loading}>
                        {saving ? "Saving..." : "Create Plan"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {!selectedPlan ? (
                  <div className={styles.note}>Select a plan pill to open it, or use Add New Plan to create one.</div>
                ) : (
                  <>
                    <div className={styles.summaryCard}>
                      <div>
                        <h2 className={styles.sectionTitle}>{selectedPlan.planName}</h2>
                        <p className={styles.helperText}>{formatPriority(selectedPlan.priority)} priority · {selectedPlan.startDate} to {selectedPlan.endDate}</p>
                      </div>
                      <div className={styles.summaryStats}>
                        <div className={styles.statCard}>
                          <span className={styles.statLabel}>Status</span>
                          <strong className={styles.statValue}>{formatAssignmentStatusLabel(planStatusDraft === "completed" ? "completed" : "in_progress")}</strong>
                        </div>
                        <div className={styles.statCard}>
                          <span className={styles.statLabel}>Items</span>
                          <strong className={styles.statValue}>{planSummaryDraft.totalTasks}</strong>
                        </div>
                        <div className={styles.statCard}>
                          <span className={styles.statLabel}>Progress</span>
                          <strong className={styles.statValue}>{selectedPlanCompletionPercent}%</strong>
                        </div>
                        <div className={styles.statCard}>
                          <span className={styles.statLabel}>Credits Used</span>
                          <strong className={styles.statValue}>{selectedPlanCredits}</strong>
                        </div>
                      </div>
                      <div className={styles.inlineActions}>
                        <button type="button" className={styles.primaryButton} onClick={() => setShowRecommendations((prev) => !prev)} disabled={!canEditSelectedPlan}>
                          {showRecommendations ? "Hide Recommendations" : "Show Recommendations"}
                        </button>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => {
                            setManualActivityDraft((prev) => ({ ...prev, completeByDate: selectedPlan.endDate }));
                            setManualActivityModalOpen(true);
                          }}
                          disabled={!canEditSelectedPlan}
                        >
                          Add New Activity
                        </button>
                      </div>
                      {!canEditSelectedPlan ? <p className={styles.info}>Only the plan creator can add or remove activities from this plan.</p> : null}
                    </div>

                    <div className={styles.confirmationCard}>
                      <div className={styles.sectionHeaderRow}>
                        <h3 className={styles.sectionTitle}>Current Plan Items</h3>
                        {canEditSelectedPlan ? (
                          <div className={styles.sectionActions}>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() => void handleSavePlanDraftItems()}
                              disabled={savingPlanItems || !hasPendingPlanChanges}
                            >
                              {savingPlanItems ? "Saving..." : "Save"}
                            </button>
                            <button type="button" className={styles.secondaryButton} onClick={handleCancelPlanEditing}>
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                      {planItemsDraft.length === 0 ? (
                        <p className={styles.info}>No activities in this plan yet. Use Show Recommendations or Add New Activity to build the plan.</p>
                      ) : (
                        <div className={styles.planItemList}>
                          {planItemsDraft.map((item) => (
                            <div key={item.id} className={styles.planItemRow}>
                              <button type="button" className={styles.planItemButton} onClick={() => setSelectedDetailItem(toDetailItem(item))}>
                                <span className={styles.planItemTitle}>{item.activityTitle}</span>
                                <span className={styles.planItemMetaRow}>
                                  {formatPlanItemType(item)} · Due {item.completeByDate || "Not set"} · {formatAssignmentStatusLabel(item.assignmentStatus)}{item.creditsRequired > 0 ? ` · ${item.creditsRequired} credits` : ""}
                                </span>
                              </button>
                              <div className={styles.planItemActions}>
                                {isOverdue(item) ? <span className={styles.overdueBadge}>Overdue</span> : null}
                                {canEditSelectedPlan ? (
                                  <button
                                    type="button"
                                    className={styles.ghostButton}
                                    onClick={() => void handleRemovePlanItem(item)}
                                    disabled={savingPlanItems}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {showRecommendations ? (
                      <div className={styles.summaryCard}>
                        <div className={styles.planListHeader}>
                          <div>
                            <h3 className={styles.sectionTitle}>Recommended Activities</h3>
                            <p className={styles.helperText}>Recommendations are shown only when you choose to add activities. Added items are staged in Current Plan Items first. Credits are charged only after Save is confirmed, and are not refundable if the task is removed later.</p>
                          </div>
                          <button type="button" className={styles.secondaryButton} onClick={() => setSearchModalOpen(true)}>
                            Search Resources
                          </button>
                        </div>

                        {loadingRecommendations ? <p className={styles.info}>Loading recommendations...</p> : null}
                        {!loadingRecommendations && recommendations.length === 0 ? <div className={styles.note}>No matching public resources were found yet for the saved objectives in this tenant.</div> : null}

                        {!loadingRecommendations && recommendations.length > 0 ? (
                          <div className={styles.recommendationGrid}>
                            {recommendations.map((item) => (
                              <article key={item.id} className={styles.recommendationTile}>
                                <div className={styles.recommendationTileImage}>
                                  {item.imageUrl ? <img src={item.imageUrl} alt={item.activityTitle} /> : <div className={styles.recommendationTilePlaceholder}>{formatActivityType(item.activityType)}</div>}
                                </div>
                                <div className={styles.recommendationTileBody}>
                                  <div className={styles.recommendationTileHeader}>
                                    <div className={styles.recommendationTitleBlock}>
                                      <button type="button" className={styles.recommendationLink} onClick={() => setSelectedDetailItem(toDetailItem(item))}>{item.activityTitle}</button>
                                      <span className={item.matchType === "manual" ? styles.recommendationTrackBadge : styles.recommendationMatchBadge}>{item.matchType === "manual" ? "Added manually" : `${item.matchPercent}% match`}</span>
                                    </div>
                                  </div>
                                  <p className={styles.planMeta}>{formatActivityType(item.activityType)} · {formatMatchType(item.matchType)} · {item.creditsRequired} credits</p>
                                  <p className={styles.recommendationDescription}>{item.shortDescription || item.details || "No description available."}</p>
                                  <div className={styles.recommendationMeta}>
                                    <span className={styles.recommendationMetaLine}>Matched objective: {item.matchedObjectiveLabel}</span>
                                    <span className={styles.recommendationMetaLine}>{item.subCategoryName || item.categoryName || "General development"}</span>
                                    <span className={styles.recommendationMetaLine}>Due date defaults to the plan end date when added.</span>
                                  </div>
                                </div>
                                <div className={styles.recommendationTileFooter}>
                                  <div className={styles.recommendationActions}>
                                    <button type="button" className={styles.recommendationDetailButton} onClick={() => setSelectedDetailItem(toDetailItem(item))}>Find Out More</button>
                                    <button
                                      type="button"
                                      className={styles.primaryButton}
                                      onClick={() => void handleAddRecommendationToPlan(item)}
                                      disabled={currentPlanItemKeys.has(recommendationKey(item)) || !canEditSelectedPlan}
                                    >
                                      {currentPlanItemKeys.has(recommendationKey(item)) ? "Added" : "Add to Plan"}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        ) : null}

        {activeTab === "track" ? (
          <div className={styles.trackWorkspace}>
            {viewer?.role !== "individual" ? (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Target Individual</span>
                <select
                  className={styles.input}
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  disabled={loadingManagedSubjects || managedSubjects.length === 0}
                >
                  <option value="">Select target individual</option>
                  {managedSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.fullName}{subject.isPending ? " (Pending invite)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activePlans.length === 0 ? (
              <div className={styles.note}>Create a plan and activate it to start tracking tasks here.</div>
            ) : (
              <>
                <div className={styles.planNameList}>
                  {activePlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={selectedTrackPlanId === plan.id ? `${styles.planNameButton} ${styles.planNameButtonActive}` : styles.planNameButton}
                      onClick={() => setSelectedTrackPlanId(plan.id)}
                    >
                      {plan.planName}
                    </button>
                  ))}
                </div>

                {selectedTrackPlan ? (
                <article key={selectedTrackPlan.id} className={styles.trackCard}>
                  <div className={styles.planHeader}>
                    <div>
                      <h2 className={styles.sectionTitle}>{selectedTrackPlan.planName}</h2>
                      <p className={styles.planMeta}>{formatPriority(selectedTrackPlan.priority)} priority · {selectedTrackPlan.startDate} to {selectedTrackPlan.endDate}</p>
                    </div>
                    <span className={styles.statusBadge}>{selectedTrackPlan.status}</span>
                  </div>

                  <div className={styles.summaryStats}>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Total</span>
                      <strong className={styles.statValue}>{selectedTrackPlan.summary.totalTasks}</strong>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Completed</span>
                      <strong className={styles.statValue}>{selectedTrackPlan.summary.completedTasks}</strong>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Pending</span>
                      <strong className={styles.statValue}>{selectedTrackPlan.summary.pendingTasks}</strong>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Overdue</span>
                      <strong className={styles.statValue}>{selectedTrackPlan.summary.overdueTasks}</strong>
                    </div>
                  </div>

                  <div className={styles.trackList}>
                    {selectedTrackPlan.items.map((item) => (
                      <article key={item.id} className={styles.recommendationTile}>
                        <div className={styles.recommendationTileImage}>
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.activityTitle} /> : <div className={styles.recommendationTilePlaceholder}>{formatActivityType(item.activityType)}</div>}
                        </div>
                        <div className={styles.recommendationTileBody}>
                          <div className={styles.recommendationTileHeader}>
                            <div className={styles.recommendationTitleBlock}>
                              <button
                                type="button"
                                className={styles.recommendationLink}
                                onClick={() => setSelectedDetailItem(toDetailItem(item))}
                              >
                                {item.activityTitle}
                              </button>
                              <span className={styles.recommendationTrackBadge}>{item.assignmentStatus || "assigned"}</span>
                            </div>
                          </div>
                          <p className={styles.planMeta}>
                            {formatActivityType(item.activityType)} · {item.creditsRequired} credits
                          </p>
                          <p className={styles.recommendationDescription}>
                            {item.shortDescription || item.details || "No description available."}
                          </p>
                          <div className={styles.recommendationMeta}>
                            <span className={styles.recommendationMetaLine}>Due: {item.completeByDate || "Not set"}</span>
                            <span className={styles.recommendationMetaLine}>{item.subCategoryName || item.categoryName || "General development"}</span>
                            <span className={styles.recommendationMetaLine}>{typeof item.competencyLevel === "number" ? `Level ${item.competencyLevel}` : "Any level"}</span>
                          </div>
                        </div>
                        <div className={styles.recommendationTileFooter}>
                          <div className={styles.trackTileStatusRow}>
                            {isOverdue(item) ? <span className={styles.overdueBadge}>Overdue</span> : <span className={styles.trackStatusSpacer} />}
                          </div>
                          <div className={styles.trackTileActions}>
                            <button
                              type="button"
                              className={styles.recommendationDetailButton}
                              onClick={() => setSelectedDetailItem(toDetailItem(item))}
                            >
                              Find Out More
                            </button>
                            <button type="button" className={styles.primaryButton} onClick={() => handleLaunchTask(item)}>
                              Launch Now
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </article>
                ) : null}
              </>
            )}
          </div>
        ) : null}
          </div>
        </section>
      </div>
      </div>
      {manualActivityModalOpen ? (
        <div className={styles.modalBackdrop} onClick={() => setManualActivityModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Add New Activity</h2>
                <p className={styles.helperText}>Search an existing resource to add directly, or enter a manual activity below.</p>
              </div>
              <button type="button" className={styles.ghostButton} onClick={() => setManualActivityModalOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.manualSearchRow}>
              <input
                className={styles.input}
                value={manualSearchText}
                onChange={(event) => setManualSearchText(event.target.value)}
                placeholder="Search a program, event, or assessment"
              />
              <button type="button" className={styles.secondaryButton} onClick={() => void handleManualResourceSearch()} disabled={searchingResources}>
                {searchingResources ? "Searching..." : "Search Resource"}
              </button>
            </div>
            {manualSearchText.trim().length > 0 || searchResults.length > 0 ? (
              <div className={styles.manualSearchResults}>
                {searchResults.map((item) => (
                  <div key={`${item.id}-manual-search`} className={styles.manualSearchResultRow}>
                    <button type="button" className={styles.planItemButton} onClick={() => setSelectedDetailItem(toDetailItem(item))}>
                      <span className={styles.planItemTitle}>{item.activityTitle}</span>
                      <span className={styles.planItemMetaRow}>{formatActivityType(item.activityType)} · {item.creditsRequired} credits</span>
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => void handleAddRecommendationToPlan(item)}
                      disabled={item.selected || savingPlanItems}
                    >
                      {item.selected ? "Added" : savingPlanItems ? "Adding..." : "Add to Plan"}
                    </button>
                  </div>
                ))}
                {!searchingResources && searchResults.length === 0 ? <p className={styles.info}>No matching resources found.</p> : null}
              </div>
            ) : null}
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Activity Name</span>
                <input
                  className={styles.input}
                  value={manualActivityDraft.activityTitle}
                  onChange={(event) => setManualActivityDraft((prev) => ({ ...prev, activityTitle: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Due Date</span>
                <input
                  className={styles.input}
                  type="date"
                  value={manualActivityDraft.completeByDate}
                  onChange={(event) => setManualActivityDraft((prev) => ({ ...prev, completeByDate: event.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Status</span>
                <select
                  className={styles.input}
                  value={manualActivityDraft.assignmentStatus}
                  onChange={(event) => setManualActivityDraft((prev) => ({ ...prev, assignmentStatus: event.target.value as AssignmentStatus }))}
                >
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className={`${styles.field} ${styles.fieldSpanFull}`}>
                <span className={styles.fieldLabel}>Activity Details</span>
                <textarea
                  className={styles.textarea}
                  value={manualActivityDraft.details}
                  onChange={(event) => setManualActivityDraft((prev) => ({ ...prev, details: event.target.value }))}
                  rows={5}
                />
              </label>
            </div>
            <div className={styles.actionsRow}>
              <button type="button" className={styles.primaryButton} onClick={() => void handleAddManualActivity()} disabled={savingPlanItems}>
                {savingPlanItems ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {searchModalOpen ? (
        <div className={styles.modalBackdrop} onClick={() => setSearchModalOpen(false)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Search Resources</h2>
                <p className={styles.helperText}>Search programs, assessments, and events to add them to the selected plan.</p>
              </div>
              <button type="button" className={styles.ghostButton} onClick={() => setSearchModalOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.modalFilters}>
              <input className={styles.input} value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search name or description" />
              <label className={styles.checkboxRow}><input type="checkbox" checked={includePrograms} onChange={(event) => setIncludePrograms(event.target.checked)} /><span>Programs</span></label>
              <label className={styles.checkboxRow}><input type="checkbox" checked={includeAssessments} onChange={(event) => setIncludeAssessments(event.target.checked)} /><span>Assessments</span></label>
              <label className={styles.checkboxRow}><input type="checkbox" checked={includeEvents} onChange={(event) => setIncludeEvents(event.target.checked)} /><span>Events</span></label>
              <button type="button" className={styles.primaryButton} onClick={() => void handleResourceSearch()} disabled={searchingResources}>
                {searchingResources ? "Searching..." : "Search"}
              </button>
            </div>
            <div className={styles.modalResults}>
              {searchResults.map((item) => (
                <article key={`${item.id}-search`} className={styles.recommendationTile}>
                  <div className={styles.recommendationTileImage}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.activityTitle} /> : <div className={styles.recommendationTilePlaceholder}>{formatActivityType(item.activityType)}</div>}
                  </div>
                  <div className={styles.recommendationTileBody}>
                    <div className={styles.recommendationTileHeader}>
                      <div className={styles.recommendationTitleBlock}>
                        <button type="button" className={styles.recommendationLink} onClick={() => setSelectedDetailItem(toDetailItem(item))}>{item.activityTitle}</button>
                        <span className={styles.recommendationTrackBadge}>Search result</span>
                      </div>
                    </div>
                    <p className={styles.planMeta}>{formatActivityType(item.activityType)} · {item.creditsRequired} credits</p>
                    <p className={styles.recommendationDescription}>{item.shortDescription || item.details || "No description available."}</p>
                  </div>
                  <div className={styles.recommendationTileFooter}>
                    <div className={styles.trackTileActions}>
                      <button type="button" className={styles.recommendationDetailButton} onClick={() => setSelectedDetailItem(toDetailItem(item))}>Find Out More</button>
                      <button type="button" className={styles.primaryButton} onClick={() => handleAddSearchResultToPlan(item)} disabled={currentPlanItemKeys.has(recommendationKey(item))}>
                        {currentPlanItemKeys.has(recommendationKey(item)) ? "Added" : "Add to Plan"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!searchingResources && searchResults.length === 0 ? <p className={styles.info}>No search results yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
      <DetailModal
        item={selectedDetailItem}
        isOpen={Boolean(selectedDetailItem)}
        onClose={() => setSelectedDetailItem(null)}
        userType={viewer?.role === "individual" ? "learner" : "coach"}
        isLoggedIn={Boolean(viewer)}
        userId={viewer?.userId}
        userName={viewer?.fullName}
        userRole={viewer?.role}
        tenantId={tenantConfig.id}
      />
    </>
  );
}