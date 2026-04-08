export const PROGRAM_DELIVERY_TYPES = ["course", "workshop", "cohort", "webinar", "masterclass", "self_learning"] as const;
export const PROGRAM_DURATION_UNITS = ["minutes", "hours", "days", "weeks", "months"] as const;
export const PROGRAM_OWNERSHIP_SCOPES = ["platform", "company", "professional"] as const;
export const PROGRAM_CATALOG_VISIBILITY = ["tenant_wide", "company_only", "professional_only"] as const;
export const PROGRAM_PUBLICATION_STATES = ["draft", "published", "pending_publication_review", "rejected_publication"] as const;
export const PROGRAM_STATUSES = ["draft", "published", "inactive", "archived"] as const;

export type ProgramDeliveryType = (typeof PROGRAM_DELIVERY_TYPES)[number];
export type ProgramDurationUnit = (typeof PROGRAM_DURATION_UNITS)[number];
export type ProgramOwnershipScope = (typeof PROGRAM_OWNERSHIP_SCOPES)[number];
export type ProgramCatalogVisibility = (typeof PROGRAM_CATALOG_VISIBILITY)[number];
export type ProgramPublicationState = (typeof PROGRAM_PUBLICATION_STATES)[number];
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export type ProgramRecord = {
  id: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  deliveryType: ProgramDeliveryType;
  durationValue: number;
  durationUnit: ProgramDurationUnit;
  details: string;
  videoUrl: string | null;
  creditsRequired: number;
  availableFrom: Date | null;
  expiresAt: Date | null;
  status: ProgramStatus;
  facilitatorName: string | null;
  promoted: boolean;
  ownershipScope: ProgramOwnershipScope;
  ownerEntityId: string | null;
  catalogVisibility: ProgramCatalogVisibility;
  publicationState: ProgramPublicationState;
  createdBy: string;
  updatedBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
};

export type ProgramWriteInput = {
  id?: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  deliveryType: ProgramDeliveryType;
  durationValue: number;
  durationUnit: ProgramDurationUnit;
  details: string;
  videoUrl: string | null;
  creditsRequired: number;
  availableFrom: string | null;
  expiresAt: string | null;
  status: ProgramStatus;
  facilitatorName: string | null;
  promoted: boolean;
  ownershipScope: ProgramOwnershipScope;
  ownerEntityId: string | null;
  catalogVisibility: ProgramCatalogVisibility;
  publicationState: ProgramPublicationState;
};

export type ProgramFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  deliveryType: ProgramDeliveryType;
  durationValue: string;
  durationUnit: ProgramDurationUnit;
  details: string;
  videoUrl: string;
  creditsRequired: string;
  availableFrom: string;
  expiresAt: string;
  status: ProgramStatus;
  facilitatorName: string;
  promoted: boolean;
  published: boolean;
  ownershipScope: ProgramOwnershipScope;
  ownerEntityId: string;
  catalogVisibility: ProgramCatalogVisibility;
  publicationState: ProgramPublicationState;
  thumbnailUrl: string;
  thumbnailPath: string;
};

export type ProgramSaveMode = "draft" | "publish";

export const DEFAULT_PROGRAM_FORM_VALUES: ProgramFormValues = {
  tenantId: "",
  name: "",
  shortDescription: "",
  longDescription: "",
  deliveryType: "course",
  durationValue: "",
  durationUnit: "weeks",
  details: "",
  videoUrl: "",
  creditsRequired: "0",
  availableFrom: "",
  expiresAt: "",
  status: "draft",
  facilitatorName: "",
  promoted: false,
  published: false,
  ownershipScope: "platform",
  ownerEntityId: "",
  catalogVisibility: "tenant_wide",
  publicationState: "draft",
  thumbnailUrl: "",
  thumbnailPath: "",
};

export const PROGRAM_DELIVERY_TYPE_LABELS: Record<ProgramDeliveryType, string> = {
  course: "Course",
  workshop: "Workshop",
  cohort: "Cohort",
  webinar: "Webinar",
  masterclass: "Masterclass",
  self_learning: "Self Learning",
};

export const PROGRAM_DURATION_UNIT_LABELS: Record<ProgramDurationUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Draft",
  published: "Published",
  inactive: "Inactive",
  archived: "Archived",
};

export function toDateInputValue(value: Date | null): string {
  if (!value) {
    return "";
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
