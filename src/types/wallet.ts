import { Timestamp } from "firebase/firestore";

export type WalletUserType = "company" | "professional" | "individual";

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

export type AssignCoinsInput = {
  userId: string;
  tenantId: string;
  userType: WalletUserType;
  userName: string;
  coinsToAssign: number;
  assignedBy: string;
};
