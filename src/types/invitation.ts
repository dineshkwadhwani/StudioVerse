import type { Timestamp } from "firebase/firestore";
import type { ProfileUserType } from "./profile";

export type InvitationStatus = "pending" | "claimed";

export type InvitationUserType = Exclude<ProfileUserType, "company">;

export type InvitationCreatorRole = "superadmin" | "company" | "professional";

export type InvitationRecord = {
  invitationId: string;
  tenantId: string;
  userType: InvitationUserType;
  role: InvitationUserType;
  firstName: string;
  lastName: string;
  fullName: string;
  name: string;
  email: string;
  phoneE164: string;
  phone: string;
  associatedCompanyId: string | null;
  associatedProfessionalId: string | null;
  companyName: string;
  createdByUserId: string;
  createdByRole: InvitationCreatorRole;
  status: InvitationStatus;
  claimedUid: string | null;
  claimedUserId: string | null;
  claimedAt: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type InvitationCreateInput = Omit<
  InvitationRecord,
  "invitationId" | "status" | "claimedUid" | "claimedUserId" | "claimedAt" | "createdAt" | "updatedAt"
>;
