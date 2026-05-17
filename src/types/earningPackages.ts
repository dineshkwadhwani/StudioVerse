import type { CoinPackageRecord } from "./coinPackage";
import type { ListingPackageRecord } from "./listingPackage";
import type { BotHeroPackageRecord } from "./botHero";

export type LeadFeeRecord = {
  id: string;
  name: string;
  amount: number;
  description?: string;
};

export type LeadPackageRecord = {
  id: string;
  name: string;
  userType: "company" | "professional" | "individual";
  enabled: boolean;
  leadFee: number;
  description?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  updatedAt?: any;
};

import type { PromotionPackageRecord } from "./promotionPackage";

export type EarningPackagesRecord = {
  tenantId: string;
  creditPackages: CoinPackageRecord[];
  listingPackages: ListingPackageRecord[];
  botPackages: BotHeroPackageRecord[];
  promotionPackages: PromotionPackageRecord[];
  leadPackages: LeadPackageRecord[];
  leadFees: LeadFeeRecord[];
  updatedAt?: any;
  createdAt?: any;
};
