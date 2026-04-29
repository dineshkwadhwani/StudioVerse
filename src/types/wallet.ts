import { Timestamp } from "firebase/firestore";

export type WalletUserType = "superadmin" | "company" | "professional" | "individual";

export type WalletRecord = {
  id: string;
  userId: string;
  tenantId: string;
  userType: WalletUserType;
  userName: string;
  totalIssuedCoins: number;
  utilizedCoins: number;
  availableCoins: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type WalletSummary = {
  totalIssuedCoins: number;
  totalUtilizedCoins: number;
};

export type WalletTransactionType = "credit" | "debit" | "sent" | "received";

export type WalletTransactionRecord = {
  id: string;
  walletId: string;
  userId: string;
  tenantId: string;
  userType: WalletUserType;
  userName: string;
  transactionType: WalletTransactionType;
  reason?: string;
  coins: number;
  assignmentId?: string;
  activityType?: string;
  activityId?: string;
  createdBy: string;
  createdAt?: Timestamp;
};

export type AssignCoinsInput = {
  userId: string;
  tenantId: string;
  userType: WalletUserType;
  userName: string;
  coinsToAssign: number;
  assignedBy: string;
};
