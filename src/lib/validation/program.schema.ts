import { z } from "zod";
import {
  DEFAULT_PROGRAM_FORM_VALUES,
  PROGRAM_CATALOG_VISIBILITY,
  PROGRAM_DELIVERY_TYPES,
  PROGRAM_DURATION_UNITS,
  PROGRAM_OWNERSHIP_SCOPES,
  PROGRAM_PUBLICATION_STATES,
  PROGRAM_STATUSES,
  PROGRAM_VISIBILITIES,
  type ProgramFormValues,
  type ProgramSaveMode,
  type ProgramWriteInput,
} from "@/types/program";

const optionalTrimmedString = z.string().trim().transform((value) => value || "");
const optionalNullableUrl = z
  .string()
  .trim()
  .transform((value) => value || "")
  .refine((value) => !value || /^https?:\/\//i.test(value), "Enter a valid URL starting with http:// or https://")
  .transform((value) => value || null);

export const programFormSchema = z.object({
  id: z.string().trim().optional(),
  tenantId: z.string().trim(),
  tenantIds: z.array(z.string().trim()).default([]),
  name: optionalTrimmedString,
  shortDescription: optionalTrimmedString,
  longDescription: optionalTrimmedString,
  deliveryType: z.enum(PROGRAM_DELIVERY_TYPES),
  durationValue: z.string().trim(),
  durationUnit: z.enum(PROGRAM_DURATION_UNITS),
  details: optionalTrimmedString,
  videoUrl: z.string().trim(),
  creditsRequired: z.string().trim(),
  availableFrom: z.string().trim(),
  expiresAt: z.string().trim(),
  status: z.enum(PROGRAM_STATUSES),
  facilitatorName: optionalTrimmedString,
  promoted: z.boolean(),
  promotionPackageId: z.string().trim(),
  promotionStatus: z.enum(["none", "requested", "promoted"]),
  listingPackageId: z.string().trim(),
  listingStatus: z.enum(["none", "requested", "approved", "rejected"]),
  published: z.boolean(),
  visibility: z.enum(PROGRAM_VISIBILITIES),
  ownershipScope: z.enum(PROGRAM_OWNERSHIP_SCOPES),
  ownerEntityId: z.string().trim(),
  catalogVisibility: z.enum(PROGRAM_CATALOG_VISIBILITY),
  publicationState: z.enum(PROGRAM_PUBLICATION_STATES),
  thumbnailUrl: z.string().trim(),
  thumbnailPath: z.string().trim(),
});

export type ProgramFormErrors = Partial<Record<keyof ProgramFormValues | "form", string>>;

function toProgramBoundaryIso(value: string, boundary: "start" | "end"): string | null {
  if (!value) {
    return null;
  }

  const suffix = boundary === "start" ? "T00:00:00" : "T23:59:00";
  return new Date(`${value}${suffix}`).toISOString();
}

export function normalizeProgramForm(values: ProgramFormValues, mode: ProgramSaveMode, isSuperAdmin?: boolean): ProgramWriteInput {
  void mode;
  const parsed = programFormSchema.parse(values);
  const durationValue = parsed.durationValue ? Number(parsed.durationValue) : 0;
  const creditsRequired = parsed.creditsRequired ? Number(parsed.creditsRequired) : 0;

  const isPublicVisibility = parsed.visibility === "public";
  const hasListingRequest = parsed.published && isPublicVisibility && Boolean(parsed.listingPackageId);
  // Private published programs are available for assignment immediately without approval.
  // Public published programs go to superadmin auto-approval or pending review queue.
  const publicationState = parsed.published
    ? (isSuperAdmin || !isPublicVisibility ? "published" : "pending_publication_review")
    : "draft";
  const status = parsed.published && (isSuperAdmin || !isPublicVisibility) ? "published" : "draft";
  const listingStatus = parsed.published && isPublicVisibility
    ? (isSuperAdmin ? "approved" : "requested")
    : "none";
  const catalogVisibility = parsed.visibility === "private" ? "professional_only" : "tenant_wide";
  const hasPromotionRequest = parsed.promoted && Boolean(parsed.promotionPackageId);
  // Superadmins bypass the approval queue — their promotions are auto-approved
  const promotionStatus = hasPromotionRequest ? (isSuperAdmin ? "promoted" : "requested") : "none";

  return {
    id: parsed.id,
    tenantId: parsed.tenantId,
    tenantIds: parsed.tenantIds,
    name: parsed.name,
    shortDescription: parsed.shortDescription,
    longDescription: parsed.longDescription,
    thumbnailUrl: parsed.thumbnailUrl || null,
    thumbnailPath: parsed.thumbnailPath || null,
    deliveryType: parsed.deliveryType,
    durationValue,
    durationUnit: parsed.durationUnit,
    details: parsed.details,
    videoUrl: parsed.videoUrl ? optionalNullableUrl.parse(parsed.videoUrl) : null,
    creditsRequired,
    availableFrom: toProgramBoundaryIso(parsed.availableFrom, "start"),
    expiresAt: toProgramBoundaryIso(parsed.expiresAt, "end"),
    status,
    facilitatorName: parsed.facilitatorName || null,
    promoted: hasPromotionRequest && isSuperAdmin ? true : false,
    promotionPackageId: hasPromotionRequest ? parsed.promotionPackageId : null,
    promotionStatus,
    listingPackageId: hasListingRequest ? parsed.listingPackageId : null,
    listingStatus,
    visibility: parsed.visibility,
    ownershipScope: parsed.ownershipScope,
    ownerEntityId: parsed.ownerEntityId || null,
    catalogVisibility,
    publicationState,
  };
}

export function validateProgramForm(
  values: ProgramFormValues,
  mode: ProgramSaveMode,
  options?: { hasSelectedThumbnail?: boolean; isSuperAdmin?: boolean },
): ProgramFormErrors {
  const errors: ProgramFormErrors = {};

  const name = values.name.trim();
  const shortDescription = values.shortDescription.trim();
  const longDescription = values.longDescription.trim();
  const details = values.details.trim();
  const tenantId = values.tenantId.trim();
  const tenantIds = Array.isArray(values.tenantIds) ? values.tenantIds.filter((value) => value.trim()) : [];
  const durationValue = values.durationValue.trim();
  const creditsRequired = values.creditsRequired.trim();

  if (!tenantId || tenantIds.length === 0) {
    errors.tenantId = "Select a tenant.";
  }

  // Require certain fields when publishing
  if (values.published) {
    if (!name) {
      errors.name = "Program name is required.";
    }
    if (!shortDescription) {
      errors.shortDescription = "Short description is required to publish.";
    }
    if (!longDescription) {
      errors.longDescription = "Long description is required to publish.";
    }
    if (!details) {
      errors.details = "Details are required to publish.";
    }
    if (!options?.hasSelectedThumbnail && (!values.thumbnailUrl.trim() || !values.thumbnailPath.trim())) {
      errors.thumbnailUrl = "Thumbnail upload is required to publish.";
    }
  }

  if (values.videoUrl.trim() && !/^https?:\/\//i.test(values.videoUrl.trim())) {
    errors.videoUrl = "Enter a valid URL starting with http:// or https://";
  }

  if (durationValue) {
    const numericDuration = Number(durationValue);
    if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
      errors.durationValue = "Duration must be a positive number.";
    }
  } else if (mode === "publish") {
    errors.durationValue = "Duration is required to publish.";
  }

  if (creditsRequired) {
    const numericCredits = Number(creditsRequired);
    if (!Number.isFinite(numericCredits) || numericCredits < 0) {
      errors.creditsRequired = "Credits required cannot be negative.";
    }
  } else if (mode === "publish") {
    errors.creditsRequired = "Credits required is mandatory to publish.";
  }

  if (values.availableFrom && Number.isNaN(Date.parse(`${values.availableFrom}T00:00:00`))) {
    errors.availableFrom = "Available from date is invalid.";
  }

  if (values.expiresAt && Number.isNaN(Date.parse(`${values.expiresAt}T23:59:00`))) {
    errors.expiresAt = "Expiry date is invalid.";
  }

  if (values.availableFrom && values.expiresAt) {
    const availableFrom = Date.parse(`${values.availableFrom}T00:00:00`);
    const expiresAt = Date.parse(`${values.expiresAt}T23:59:00`);
    if (availableFrom > expiresAt) {
      errors.expiresAt = "Expiry date must be after available from date.";
    }
  }

  if (!PROGRAM_OWNERSHIP_SCOPES.includes(values.ownershipScope as typeof PROGRAM_OWNERSHIP_SCOPES[number])) {
    errors.ownershipScope = "Invalid ownership scope.";
  }

  if (!["public", "private"].includes(values.visibility)) {
    errors.visibility = "Visibility must be public or private.";
  }

  if (values.promoted && !values.promotionPackageId.trim()) {
    errors.promotionPackageId = "Select a promotion package for promoted Programs.";
  }

  if (values.published && values.visibility === "public" && !options?.isSuperAdmin && !values.listingPackageId.trim()) {
    errors.listingPackageId = "Select a listing package to make this program visible in the public catalogue.";
  }

  if (mode === "publish") {
    if (values.status === "archived") {
      errors.status = "Archived Programs cannot be published.";
    }
    if (values.publicationState === "rejected_publication") {
      errors.publicationState = "Rejected publication is not supported in this epic.";
    }
  }

  return errors;
}

export function createProgramFormValues(overrides?: Partial<ProgramFormValues>): ProgramFormValues {
  return {
    ...DEFAULT_PROGRAM_FORM_VALUES,
    ...overrides,
  };
}
