import { Timestamp } from "firebase/firestore";

export type CoinRequestStatus = "pending" | "approved" | "denied";

export interface CoinRequest {
  id: string;
  tenantId: string;
  // Requester is always a professional
  requesterProfessionalId: string;
  requesterName: string;
  // Approver is always a company
  companyId: string;
  companyName: string;
  amount: number;
  message?: string;
  status: CoinRequestStatus;
  approvalComment?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  deniedBy?: string;
  deniedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoinRequestFormValues {
  amount: number;
  message: string;
}

export interface CoinRequestApprovalInput {
  requestId: string;
  comment?: string;
}

export interface CoinRequestDenialInput {
  requestId: string;
  reason?: string;
}
