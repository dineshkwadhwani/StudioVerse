import type { Timestamp } from "firebase/firestore";

export type ReferredType = "coach" | "individual";
export type ReferralStatus = "referred" | "reminded" | "joined";
export type ReferrerRole = "company" | "professional" | "individual" | "superadmin";

export type ReferralRecord = {
  id: string;
  tenantId: string;
  referrerUserId: string;
  referrerName: string;
  referrerRole: ReferrerRole;
  referrerCompanyId?: string | null;
  referredType: ReferredType;
  referredEmail: string;
  referredPhone: string;
  status: ReferralStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  joinedAt?: Timestamp;
  joinedUserId?: string;
  reminderSentAt?: Timestamp;
};
