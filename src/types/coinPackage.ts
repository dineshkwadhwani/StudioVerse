import type { Timestamp } from "firebase/firestore";

export type CoinPackageStatus = "active" | "inactive";

export type CoinPackageRecord = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  credits: number;
  priceInr: number;
  status: CoinPackageStatus;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type CoinPackageFormValues = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  credits: string;
  priceInr: string;
  status: CoinPackageStatus;
  sortOrder: string;
};

export type CoinPackageFormErrors = Partial<Record<keyof CoinPackageFormValues, string>>;

export const DEFAULT_COIN_PACKAGES: Array<Omit<CoinPackageRecord, "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">> = [
  { name: "Starter", description: "Great for getting started", credits: 20, priceInr: 500, status: "active", sortOrder: 1 },
  { name: "Player", description: "For regular platform users", credits: 50, priceInr: 1200, status: "active", sortOrder: 2 },
  { name: "Champion", description: "For power users", credits: 100, priceInr: 2000, status: "active", sortOrder: 3 },
  { name: "Pro", description: "Maximum value for growing teams", credits: 250, priceInr: 4000, status: "active", sortOrder: 4 },
  { name: "Elite", description: "Best value — full platform power", credits: 500, priceInr: 7500, status: "active", sortOrder: 5 },
];
