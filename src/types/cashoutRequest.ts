import type { Timestamp } from "firebase/firestore";

export type CashoutRequestStatus = "pending" | "approved" | "denied";

export type CashoutRequesterType = "company" | "professional";

export type CashoutRequest = {
  id: string;
  tenantId: string;
  requesterUserId: string;
  requesterName: string;
  requesterCompanyName?: string;
  requesterUserType: CashoutRequesterType;
  requesterAssociatedCompanyId?: string | null;
  creditsRequested: number;
  creditCost: number;
  cashbackPercentage: number;
  grossAmountRs: number;
  payoutAmountRs: number;
  status: CashoutRequestStatus;
  requestComment?: string;
  approvalComment?: string;
  denialReason?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  deniedBy?: string;
  deniedAt?: Timestamp;
  payoutProvider?: string;
  payoutStatus?: string;
  payoutReference?: string;
  walletTransactionId?: string;
  refundTransactionId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CashoutConfig = {
  creditCost: number;
  cashbackPercentage: number;
  minimumCredits: number;
};
