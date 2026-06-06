import type { Timestamp } from "firebase/firestore";
import type { ActivityType, AssignmentStatus } from "@/types/assignment";
import type { CompetencyLevelValue } from "@/types/competency";

export type DevelopmentPlanPriority = "high" | "medium" | "low";

export type DevelopmentPlanStatus = "draft" | "active" | "completed" | "archived";

export type DevelopmentObjectiveStatus = "not_set" | "set";

export type DevelopmentDocumentType = "plan" | "objectivesProfile";

export type DevelopmentActorRole = "company" | "professional" | "individual";

export type DevelopmentRecommendationActorContext = {
  role: DevelopmentActorRole;
  companyIds: string[];
  professionalIds: string[];
  coachIds: string[];
};

export type DevelopmentObjectiveRecord = {
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  topicId?: string;
  topicName?: string;
  targetLevel: CompetencyLevelValue;
};

export type DevelopmentPlanItemRecord = {
  id: string;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  shortDescription?: string;
  details?: string;
  imageUrl?: string;
  categoryId?: string;
  categoryName?: string;
  subCategoryId?: string;
  subCategoryName?: string;
  topicId?: string;
  topicName?: string;
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
  completeByDate?: string;
  selected: boolean;
  assignmentId?: string;
  assignmentStatus?: AssignmentStatus;
};

export type DevelopmentRecommendationMatchType = "competency" | "competencyAndSkill" | "highlyRecommended" | "manual";

export type DevelopmentPlanRecommendationRecord = DevelopmentPlanItemRecord & {
  matchType: DevelopmentRecommendationMatchType;
  matchPercent: number;
  matchedObjectiveLabel: string;
};

export type DevelopmentPlanSummary = {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
};

export type DevelopmentPlanRecord = {
  id: string;
  aggregateId?: string;
  documentType?: DevelopmentDocumentType;
  tenantId: string;
  planName: string;
  priority: DevelopmentPlanPriority;
  startDate: string;
  endDate: string;
  status: DevelopmentPlanStatus;
  objectiveStatus: DevelopmentObjectiveStatus;
  creatorUserId: string;
  creatorName: string;
  creatorRole: DevelopmentActorRole;
  subjectUserId: string;
  subjectName: string;
  subjectRole: DevelopmentActorRole;
  objectives: DevelopmentObjectiveRecord[];
  items: DevelopmentPlanItemRecord[];
  summary: DevelopmentPlanSummary;
  finalizedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type DevelopmentObjectivesProfileRecord = {
  id: string;
  documentType: "objectivesProfile";
  tenantId: string;
  creatorUserId: string;
  creatorName: string;
  creatorRole: DevelopmentActorRole;
  subjectUserId: string;
  subjectName: string;
  subjectRole: DevelopmentActorRole;
  objectives: DevelopmentObjectiveRecord[];
  objectiveStatus: DevelopmentObjectiveStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type DevelopmentPlanDraftInput = {
  id?: string;
  tenantId: string;
  planName: string;
  priority: DevelopmentPlanPriority;
  startDate: string;
  endDate: string;
  creatorUserId: string;
  creatorName: string;
  creatorRole: DevelopmentActorRole;
  subjectUserId: string;
  subjectName: string;
  subjectRole: DevelopmentActorRole;
  objectives?: DevelopmentObjectiveRecord[];
};

export type DevelopmentObjectivesProfileInput = {
  id?: string;
  tenantId: string;
  creatorUserId: string;
  creatorName: string;
  creatorRole: DevelopmentActorRole;
  subjectUserId: string;
  subjectName: string;
  subjectRole: DevelopmentActorRole;
  objectives: DevelopmentObjectiveRecord[];
};

export type DevelopmentPlanListArgs = {
  tenantId: string;
  userId: string;
  subjectUserIds?: string[];
};

export const EMPTY_DEVELOPMENT_PLAN_SUMMARY: DevelopmentPlanSummary = {
  totalTasks: 0,
  completedTasks: 0,
  pendingTasks: 0,
  overdueTasks: 0,
};

export const EMPTY_DEVELOPMENT_PLAN_DRAFT: Omit<DevelopmentPlanDraftInput, "tenantId" | "creatorUserId" | "creatorName" | "creatorRole" | "subjectUserId" | "subjectName" | "subjectRole"> = {
  planName: "",
  priority: "medium",
  startDate: "",
  endDate: "",
};