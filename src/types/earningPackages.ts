import type { CoinPackageRecord } from "./coinPackage";
import type { ListingPackageRecord } from "./listingPackage";
import type { BotHeroPackageRecord } from "./botHero";

export type LeadFeeRecord = {
  id: string;
  name: string;
  amount: number;
  description?: string;
};

export type EarningPackagesRecord = {
  tenantId: string;
  creditPackages: CoinPackageRecord[];
  listingPackages: ListingPackageRecord[];
  botPackages: BotHeroPackageRecord[];
  leadFees: LeadFeeRecord[];
  updatedAt?: any;
  createdAt?: any;
};
