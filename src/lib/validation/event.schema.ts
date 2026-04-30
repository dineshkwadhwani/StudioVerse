import { z } from "zod";
import {
  DEFAULT_EVENT_FORM_VALUES,
  EVENT_CATALOG_VISIBILITY,
  EVENT_OWNERSHIP_SCOPES,
  EVENT_PUBLICATION_STATES,
  EVENT_SOURCES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  type EventFormValues,
  type EventSaveMode,
  type EventWriteInput,
} from "@/types/event";

// ---------------------------------------------------------------------------
// Shared refiners
// ---------------------------------------------------------------------------
const optionalTrimmedString = z.string().trim().transform((v) => v || "");
const optionalNullableUrl = z
  .string()
  .trim()
  .transform((v) => v || "")
  .refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Enter a valid URL starting with http:// or https://",
  )
  .transform((v) => v || null);

// ---------------------------------------------------------------------------
// Zod form schema
// ---------------------------------------------------------------------------
export const eventFormSchema = z.object({
  id: z.string().trim().optional(),
  tenantId: z.string().trim(),
  tenantIds: z.array(z.string().trim()).default([]),
  name: optionalTrimmedString,
  eventType: z.enum(EVENT_TYPES),
  eventSource: z.enum(EVENT_SOURCES),
  shortDescription: optionalTrimmedString,
  longDescription: optionalTrimmedString,
  eventDate: z.string().trim(),
  eventTime: z.string().trim(),
  locationAddress: optionalTrimmedString,
  locationCity: optionalTrimmedString,
  details: optionalTrimmedString,
  videoUrl: z.string().trim(),
  creditsRequired: z.string().trim(),
  cost: z.string().trim(),
  status: z.enum(EVENT_STATUSES),
  promoted: z.boolean(),
  promotionPackageId: z.string().trim(),
  promotionStatus: z.enum(["none", "requested", "promoted"]),
  published: z.boolean(),
  visibility: z.enum(EVENT_VISIBILITIES),
  ownershipScope: z.enum(EVENT_OWNERSHIP_SCOPES),
  ownerEntityId: z.string().trim(),
  catalogVisibility: z.enum(EVENT_CATALOG_VISIBILITY),
  publicationState: z.enum(EVENT_PUBLICATION_STATES),
  thumbnailUrl: z.string().trim(),
  thumbnailPath: z.string().trim(),
});

export type EventFormErrors = Partial<Record<keyof EventFormValues | "form", string>>;

// ---------------------------------------------------------------------------
// Helper: combine date + time → ISO datetime string
// ---------------------------------------------------------------------------
function toEventDateTime(date: string, time: string): string | null {
  if (!date || !time) {
    return null;
  }
  const iso = `${date}T${time}:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

// ---------------------------------------------------------------------------
// Normalise: EventFormValues → EventWriteInput
// ---------------------------------------------------------------------------
export function normalizeEventForm(
  values: EventFormValues,
  mode: EventSaveMode,
  isSuperAdmin?: boolean,
): EventWriteInput {
  void mode;
  const parsed = eventFormSchema.parse(values);
  const creditsRequired = parsed.creditsRequired ? Number(parsed.creditsRequired) : 0;
  const cost = parsed.cost ? Number(parsed.cost) : 0;

  // Published checkbox drives both status and publicationState
  const publicationState = parsed.published ? "published" : "draft";
  const status = parsed.published ? "published" : "draft";
  const catalogVisibility = parsed.visibility === "private" ? "professional_only" : "tenant_wide";
  const hasPromotionRequest = parsed.promoted && Boolean(parsed.promotionPackageId);
  // Superadmins bypass the approval queue — their promotions are auto-approved
  const promotionStatus = hasPromotionRequest ? (isSuperAdmin ? "promoted" : "requested") : "none";

  const eventDate = parsed.eventDate || null;
  const eventTime = parsed.eventTime || null;
  const eventDateTime = toEventDateTime(parsed.eventDate, parsed.eventTime);

  return {
    id: parsed.id,
    tenantId: parsed.tenantId,
    tenantIds: parsed.tenantIds,
    name: parsed.name,
    eventType: parsed.eventType,
    eventSource: parsed.eventSource,
    shortDescription: parsed.shortDescription,
    longDescription: parsed.longDescription,
    thumbnailUrl: parsed.thumbnailUrl || null,
    thumbnailPath: parsed.thumbnailPath || null,
    eventDate,
    eventTime,
    eventDateTime,
    locationAddress: parsed.locationAddress,
    locationCity: parsed.locationCity,
    details: parsed.details,
    videoUrl: parsed.videoUrl ? optionalNullableUrl.parse(parsed.videoUrl) : null,
    creditsRequired,
    cost,
    status,
    promoted: hasPromotionRequest && isSuperAdmin ? true : false,
    promotionPackageId: hasPromotionRequest ? parsed.promotionPackageId : null,
    promotionStatus,
    visibility: parsed.visibility,
    ownershipScope: parsed.ownershipScope,
    ownerEntityId: parsed.ownerEntityId || null,
    catalogVisibility,
    publicationState,
  };
}

// ---------------------------------------------------------------------------
// Client-side validation
// ---------------------------------------------------------------------------
export function validateEventForm(
  values: EventFormValues,
  mode: EventSaveMode,
  options?: { hasSelectedThumbnail?: boolean },
): EventFormErrors {
  void mode;
  const errors: EventFormErrors = {};

  const tenantId = values.tenantId.trim();
  const tenantIds = Array.isArray(values.tenantIds) ? values.tenantIds.filter((value) => value.trim()) : [];
  const name = values.name.trim();
  const shortDescription = values.shortDescription.trim();
  const longDescription = values.longDescription.trim();
  const locationAddress = values.locationAddress.trim();
  const locationCity = values.locationCity.trim();
  const creditsRequired = values.creditsRequired.trim();
  const cost = values.cost.trim();

  if (!tenantId || tenantIds.length === 0) {
    errors.tenantId = "Select a tenant.";
  }

  if (!name) {
    errors.name = "Event name is required.";
  }

  // Publish requires additional fields (E3 §12.1 / §14)
  if (values.published) {
    if (!shortDescription) {
      errors.shortDescription = "Short description is required to publish.";
    }
    if (!longDescription) {
      errors.longDescription = "Long description is required to publish.";
    }
    if (!values.eventDate.trim()) {
      errors.eventDate = "Event date is required to publish.";
    }
    if (!values.eventTime.trim()) {
      errors.eventTime = "Event time is required to publish.";
    }
    if (!locationAddress) {
      errors.locationAddress = "Location address is required to publish.";
    }
    if (!locationCity) {
      errors.locationCity = "Location city is required to publish.";
    }
    if (
      !options?.hasSelectedThumbnail &&
      (!values.thumbnailUrl.trim() || !values.thumbnailPath.trim())
    ) {
      errors.thumbnailUrl = "Thumbnail is required to publish.";
    }
  }

  // Date + time coherence
  if (values.eventDate.trim() && Number.isNaN(Date.parse(`${values.eventDate}T00:00:00`))) {
    errors.eventDate = "Event date is not a valid date.";
  }
  if (values.eventTime.trim() && !/^\d{2}:\d{2}$/.test(values.eventTime.trim())) {
    errors.eventTime = "Event time must be in HH:MM format.";
  }
  if (values.eventDate.trim() && values.eventTime.trim()) {
    const combined = toEventDateTime(values.eventDate.trim(), values.eventTime.trim());
    if (!combined) {
      errors.eventDate = "Event date and time do not form a valid date/time.";
    }
  }

  // URL validation
  if (values.videoUrl.trim() && !/^https?:\/\//i.test(values.videoUrl.trim())) {
    errors.videoUrl = "Enter a valid URL starting with http:// or https://";
  }

  // Credits
  if (!creditsRequired) {
    errors.creditsRequired = "Credits required is mandatory.";
  } else {
    const numeric = Number(creditsRequired);
    if (!Number.isFinite(numeric) || numeric < 0) {
      errors.creditsRequired = "Credits required cannot be negative.";
    }
  }

  // Cost
  if (!cost) {
    errors.cost = "Cost is mandatory.";
  } else {
    const numeric = Number(cost);
    if (!Number.isFinite(numeric) || numeric < 0) {
      errors.cost = "Cost cannot be negative.";
    }
  }

  // E3 §14 — only platform scope is supported in this epic
  if (values.ownershipScope !== "platform") {
    errors.ownershipScope = "Only platform-owned Events are supported in this epic.";
  }

  if (!["public", "private"].includes(values.visibility)) {
    errors.visibility = "Visibility must be public or private.";
  }

  if (values.promoted && !values.promotionPackageId.trim()) {
    errors.promotionPackageId = "Select a promotion package for promoted Events.";
  }

  // Archived/cancelled events cannot be published
  if (values.published) {
    if (values.status === "archived" || values.status === "cancelled") {
      errors.status = "Archived or cancelled Events cannot be published.";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Factory to merge defaults with overrides
// ---------------------------------------------------------------------------
export function createEventFormValues(
  overrides?: Partial<EventFormValues>,
): EventFormValues {
  return {
    ...DEFAULT_EVENT_FORM_VALUES,
    ...overrides,
  };
}
