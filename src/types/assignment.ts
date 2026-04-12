import type { Timestamp } from "firebase/firestore";

export type ActivityType = "program" | "event" | "assessment";
export type AssignmentStatus = "assigned" | "registered" | "recommended" | "in_progress" | "completed" | "cancelled";

export type AssignmentRecord = {
  id: string;
  tenantId: string;
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  creditsRequired: number;
  cost?: number;
  assignerId: string;
  assignerName: string;
  assigneeId: string;
  assigneePhone: string;
  assigneeEmail: string;
  assigneeFirstName: string;
  assigneeLastName: string;
  assigneeFullName: string;
  status: AssignmentStatus;
  coinsDeducted: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type AssignmentFormInput = {
  activityType: ActivityType;
  activityId: string;
  activityTitle: string;
  creditsRequired: number;
  cost?: number;
  assigneePhone?: string;
  assigneeEmail?: string;
  coinsToDeduct: number;
};

export type UserSearchResult = {
  id: string;
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  userType: string;
  tenantId: string;
};
