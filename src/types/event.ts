// ============================================================
// Event domain types for StudioVerse — EPIC E3
//
// Publish vs Promote:
//   - Publish → status=published + publicationState=published → visible in tenant catalog
//   - Promote → promoted=true + event is fully published → surfaced on landing page
//   - promoted=true alone does NOT make an event visible
// ============================================================

export const EVENT_OWNERSHIP_SCOPES = ["platform", "company", "professional"] as const;
export const EVENT_CATALOG_VISIBILITY = ["tenant_wide", "company_only", "professional_only"] as const;
export const EVENT_TYPES = ["classroom_session", "casual_meeting", "webinar", "workshop"] as const;
export const EVENT_PUBLICATION_STATES = [
  "draft",
  "published",
  "pending_publication_review",
  "rejected_publication",
] as const;

// NOTE: Events add "cancelled" status that Programs do not have (E3 §12.7)
export const EVENT_STATUSES = ["draft", "published", "inactive", "archived", "cancelled"] as const;

export type EventOwnershipScope = (typeof EVENT_OWNERSHIP_SCOPES)[number];
export type EventCatalogVisibility = (typeof EVENT_CATALOG_VISIBILITY)[number];
export type EventType = (typeof EVENT_TYPES)[number];
export type EventPublicationState = (typeof EVENT_PUBLICATION_STATES)[number];
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Canonical Event record as returned from Firestore */
export type EventRecord = {
  id: string;
  tenantId: string;
  name: string;
  eventType: EventType;
  shortDescription: string;
  longDescription: string;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  /** ISO date string yyyy-MM-dd stored for display */
  eventDate: string | null;
  /** HH:mm stored for display */
  eventTime: string | null;
  /** ISO datetime string combining eventDate + eventTime, used for sorting/querying */
  eventDateTime: string | null;
  locationAddress: string;
  locationCity: string;
  details: string;
  videoUrl: string | null;
  creditsRequired: number;
  cost: number;
  status: EventStatus;
  /** Promoted flag — eligible for landing-page elevation only when event is also published */
  promoted: boolean;
  // Future extension: platform | company | professional
  ownershipScope: EventOwnershipScope;
  ownerEntityId: string | null;
  catalogVisibility: EventCatalogVisibility;
  publicationState: EventPublicationState;
  createdBy: string;
  updatedBy: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  archivedAt: Date | null;
  cancelledAt: Date | null;
};

/** Write input — dates as ISO strings, timestamps omitted (server sets them) */
export type EventWriteInput = {
  id?: string;
  tenantId: string;
  name: string;
  eventType: EventType;
  shortDescription: string;
  longDescription: string;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventDateTime: string | null;
  locationAddress: string;
  locationCity: string;
  details: string;
  videoUrl: string | null;
  creditsRequired: number;
  cost: number;
  status: EventStatus;
  promoted: boolean;
  ownershipScope: EventOwnershipScope;
  ownerEntityId: string | null;
  catalogVisibility: EventCatalogVisibility;
  publicationState: EventPublicationState;
};

/** Form values — all string inputs for controlled components */
export type EventFormValues = {
  id?: string;
  tenantId: string;
  name: string;
  eventType: EventType;
  shortDescription: string;
  longDescription: string;
  eventDate: string;
  eventTime: string;
  locationAddress: string;
  locationCity: string;
  details: string;
  videoUrl: string;
  creditsRequired: string;
  cost: string;
  status: EventStatus;
  promoted: boolean;
  /** Convenience boolean: true → publicationState="published" / status="published" */
  published: boolean;
  ownershipScope: EventOwnershipScope;
  ownerEntityId: string;
  catalogVisibility: EventCatalogVisibility;
  publicationState: EventPublicationState;
  thumbnailUrl: string;
  thumbnailPath: string;
};

export type EventSaveMode = "draft" | "publish";

export const DEFAULT_EVENT_FORM_VALUES: EventFormValues = {
  tenantId: "",
  name: "",
  eventType: "webinar",
  shortDescription: "",
  longDescription: "",
  eventDate: "",
  eventTime: "",
  locationAddress: "",
  locationCity: "",
  details: "",
  videoUrl: "",
  creditsRequired: "0",
  cost: "0",
  status: "draft",
  promoted: false,
  published: false,
  ownershipScope: "platform",
  ownerEntityId: "",
  catalogVisibility: "tenant_wide",
  publicationState: "draft",
  thumbnailUrl: "",
  thumbnailPath: "",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  inactive: "Inactive",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  classroom_session: "Classroom Session",
  casual_meeting: "Casual Meeting",
  webinar: "Webinar",
  workshop: "Workshop",
};
