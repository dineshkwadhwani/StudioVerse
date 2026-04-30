import type { Timestamp } from "firebase/firestore";

export const BOT_HERO_DURATION_UNITS = ["days", "weeks"] as const;
export type BotHeroDurationUnit = (typeof BOT_HERO_DURATION_UNITS)[number];

export const BOT_HERO_DURATION_UNIT_LABELS: Record<BotHeroDurationUnit, string> = {
  days: "Days",
  weeks: "Weeks",
};

// ── Package ────────────────────────────────────────────────────────────────

export type BotHeroPackageRecord = {
  id: string;
  name: string;
  description?: string;
  durationValue: number;
  durationUnit: BotHeroDurationUnit;
  credits: number;
  active: boolean;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type BotHeroPackageFormValues = {
  id?: string;
  name: string;
  description: string;
  durationValue: string;
  durationUnit: BotHeroDurationUnit;
  credits: string;
  active: boolean;
  sortOrder: string;
};

export type BotHeroPackageFormErrors = Partial<Record<keyof BotHeroPackageFormValues, string>>;

// ── Request ────────────────────────────────────────────────────────────────

export type BotHeroRequestStatus = "pending" | "approved" | "active" | "expired" | "denied";

export type BotHeroRequestRecord = {
  id: string;
  tenantId: string;
  professionalId: string;
  professionalName: string;
  professionalAvatar: string;
  packageId: string;
  packageName: string;
  durationValue: number;
  durationUnit: BotHeroDurationUnit;
  credits: number;
  walletTransactionId: string;
  status: BotHeroRequestStatus;
  preferredStartDate?: string;
  approvedStartDate?: string;
  approvedEndDate?: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  deniedBy?: string;
  deniedAt?: Timestamp;
  denialReason?: string;
  refundTransactionId?: string;
  requestedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export const BOT_HERO_STATUS_LABELS: Record<BotHeroRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  active: "Active",
  expired: "Expired",
  denied: "Denied",
};
