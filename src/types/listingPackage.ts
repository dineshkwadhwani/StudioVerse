import type { Timestamp } from "firebase/firestore";

export const LISTING_PACKAGE_RESOURCE_TYPES = ["program", "event", "assessment"] as const;
export const LISTING_PACKAGE_DURATION_UNITS = ["days", "weeks", "months"] as const;

export type ListingPackageStatus = "active" | "inactive";
export type ListingPackageResourceType = (typeof LISTING_PACKAGE_RESOURCE_TYPES)[number];
export type ListingPackageDurationUnit = (typeof LISTING_PACKAGE_DURATION_UNITS)[number];

export type ListingPackageRecord = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  resourceType: ListingPackageResourceType;
  durationValue: number;
  durationUnit: ListingPackageDurationUnit;
  costCredits: number;
  status: ListingPackageStatus;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ListingPackageFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
  imageUrl: string;
  imagePath: string;
  resourceType: ListingPackageResourceType;
  durationValue: string;
  durationUnit: ListingPackageDurationUnit;
  costCredits: string;
  status: ListingPackageStatus;
  sortOrder: string;
};

export const LISTING_RESOURCE_LABELS: Record<ListingPackageResourceType, string> = {
  program: "Program",
  event: "Event",
  assessment: "Assessment",
};

export const LISTING_DURATION_UNIT_LABELS: Record<ListingPackageDurationUnit, string> = {
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};
