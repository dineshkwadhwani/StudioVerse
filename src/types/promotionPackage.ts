import type { Timestamp } from "firebase/firestore";

export const PROMOTION_PACKAGE_RESOURCE_TYPES = ["program", "event", "assessment"] as const;
export const PROMOTION_PACKAGE_DURATION_UNITS = ["days", "weeks", "months"] as const;

export type PromotionPackageStatus = "active" | "inactive";
export type PromotionPackageResourceType = (typeof PROMOTION_PACKAGE_RESOURCE_TYPES)[number];
export type PromotionPackageDurationUnit = (typeof PROMOTION_PACKAGE_DURATION_UNITS)[number];

export type PromotionPackageRecord = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  resourceType: PromotionPackageResourceType;
  durationValue: number;
  durationUnit: PromotionPackageDurationUnit;
  costCredits: number;
  status: PromotionPackageStatus;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type PromotionPackageFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
  imageUrl: string;
  imagePath: string;
  resourceType: PromotionPackageResourceType;
  durationValue: string;
  durationUnit: PromotionPackageDurationUnit;
  costCredits: string;
  status: PromotionPackageStatus;
  sortOrder: string;
};

export type PromotionPackageFormErrors = Partial<Record<keyof PromotionPackageFormValues, string>>;

export const PROMOTION_RESOURCE_LABELS: Record<PromotionPackageResourceType, string> = {
  program: "Program",
  event: "Event",
  assessment: "Assessment",
};

export const PROMOTION_DURATION_UNIT_LABELS: Record<PromotionPackageDurationUnit, string> = {
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};
