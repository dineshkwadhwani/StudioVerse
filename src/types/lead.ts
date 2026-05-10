import type { Timestamp } from "firebase/firestore";

export type LeadKind = "coach" | "company" | "individual";

export type LeadUnlockRecord = {
  id: string;
  tenantId: string;
  unlockerUserId: string;
  unlockerUserType: "company" | "professional" | "individual";
  leadUserId: string;
  leadUserType: LeadKind;
  feeCoins: number;
  walletTransactionId?: string;
  createdAt?: Timestamp;
};

export type LeadUnlockKey = {
  tenantId: string;
  unlockerUserId: string;
  leadUserId: string;
};

export function buildLeadUnlockId(key: LeadUnlockKey): string {
  return `${key.tenantId}::${key.unlockerUserId}::${key.leadUserId}`;
}
