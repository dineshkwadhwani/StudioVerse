import type { Timestamp } from "firebase/firestore";
import type { WalletUserType } from "@/types/wallet";

export type CoinOrderStatus = "pending" | "completed" | "failed";

export type CoinOrderRecord = {
  id: string;
  userId: string;
  userName: string;
  tenantId: string;
  userType: WalletUserType;
  packageId: string;
  packageName: string;
  credits: number;
  priceInr: number;
  status: CoinOrderStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};
