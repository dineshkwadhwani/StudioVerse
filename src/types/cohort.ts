import type { Timestamp } from "firebase/firestore";

export type CohortStatus = "draft" | "inactive" | "active";
export type CohortCreatorRole = "company" | "professional";

export type CohortRecord = {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  professionalId: string | null;
  status: CohortStatus;
  memberCount: number;
  createdByUserId: string;
  createdByRole: CohortCreatorRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CohortMemberRecord = {
  id: string;
  cohortId: string;
  individualUserId: string;
  addedByUserId: string;
  addedAt?: Timestamp;
};

export type CohortListItem = CohortRecord & {
  professionalName?: string;
};

export type CohortMemberUser = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
};

export type NewCohortIndividualInput = {
  firstName: string;
  lastName: string;
  phoneE164: string;
  email: string;
};

export type SaveCohortInput = {
  cohortId?: string;
  tenantId: string;
  creatorUserId: string;
  creatorRole: CohortCreatorRole;
  creatorCompanyId?: string;
  name: string;
  professionalId?: string | null;
  existingIndividualIds: string[];
  newIndividuals: NewCohortIndividualInput[];
};

export type CohortDetail = CohortListItem & {
  members: CohortMemberUser[];
};

export type CohortAssignmentMember = {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
};

export type CohortAssignmentPayload = {
  cohortId: string;
  cohortName: string;
  members: CohortAssignmentMember[];
};
