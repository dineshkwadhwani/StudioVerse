"use client";

import { useEffect, useState, startTransition } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import EventForm from "./EventForm";
import styles from "./SuperAdminPortal.module.css";
import { auth, db } from "@/services/firebase";
import {
  createEventFormValues,
  normalizeEventForm,
  validateEventForm,
  type EventFormErrors,
} from "@/lib/validation/event.schema";
import {
  buildEventId,
  listEvents,
  saveEvent,
  uploadEventThumbnail,
  validateEventThumbnailFile,
} from "@/services/events.service";
import { listActivePromotionPackagesForTenant } from "@/services/promotionPackages.service";
import { getWalletByUserAndTenant } from "@/services/wallet.service";
import {
  EVENT_PROMOTION_STATUS_LABELS,
  EVENT_SOURCE_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  EVENT_VISIBILITY_LABELS,
  type EventFormValues,
  type EventRecord,
  type EventSaveMode,
} from "@/types/event";
import type { PromotionPackageRecord } from "@/types/promotionPackage";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type EventsSectionProps = {
  tenants?: TenantOption[];
};

function mapEventToForm(event: EventRecord): EventFormValues {
  const tenantIds = Array.isArray(event.tenantIds) && event.tenantIds.length > 0
    ? event.tenantIds
    : [event.tenantId];

  return createEventFormValues({
    id: event.id,
    tenantId: event.tenantId,
    tenantIds,
    name: event.name,
    eventType: event.eventType,
    eventSource: event.eventSource,
    shortDescription: event.shortDescription,
    longDescription: event.longDescription,
    eventDate: event.eventDate ?? "",
    eventTime: event.eventTime ?? "",
    locationAddress: event.locationAddress,
    locationCity: event.locationCity,
    details: event.details,
    videoUrl: event.videoUrl ?? "",
    creditsRequired: String(event.creditsRequired),
    cost: String(event.cost ?? 0),
    status: event.status,
    promoted: event.promotionStatus === "requested" || event.promotionStatus === "promoted",
    promotionPackageId: event.promotionPackageId ?? "",
    promotionStatus: event.promotionStatus,
    published: event.publicationState === "published",
    visibility: event.visibility === "private" ? "private" : "public",
    ownershipScope: event.ownershipScope,
    ownerEntityId: event.ownerEntityId ?? "",
    catalogVisibility: event.catalogVisibility,
    publicationState: event.publicationState,
    thumbnailUrl: event.thumbnailUrl ?? "",
    thumbnailPath: event.thumbnailPath ?? "",
  });
}

export default function EventsSection({
  tenants: propTenants,
}: EventsSectionProps) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>(propTenants ?? []);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState<EventFormErrors>({});
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<EventFormValues>(createEventFormValues());
  const [selectedThumbnail, setSelectedThumbnail] = useState<File | null>(null);
  const [promotionPackages, setPromotionPackages] = useState<PromotionPackageRecord[]>([]);
  const [promotionPackagesLoading, setPromotionPackagesLoading] = useState(false);
  const [selectedPublicationState, setSelectedPublicationState] = useState<string>("all");
  const [selectedPromoted, setSelectedPromoted] = useState<string>("all");

  async function loadTenants(): Promise<void> {
    try {
      const q = query(collection(db, "tenants"), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const loaded: TenantOption[] = snapshot.docs.map((d) => ({
        id: d.id,
        tenantId: d.data().tenantId,
        tenantName: d.data().tenantName,
        status: d.data().status,
      }));
      setTenants(loaded);
    } catch (loadError) {
      console.error("Failed to load tenants:", loadError);
      setError("Could not load tenants.");
    }
  }

  async function refreshEvents(tenantId?: string): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const nextEvents = await listEvents(tenantId);
      startTransition(() => setEvents(nextEvents));
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load Events right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    void refreshEvents(selectedTenantId || undefined);
  }, [selectedTenantId]);

  useEffect(() => {
    async function loadPromotionPackagesForForm(): Promise<void> {
      if (!formOpen || !formValues.tenantId) {
        setPromotionPackages([]);
        setPromotionPackagesLoading(false);
        return;
      }

      setPromotionPackagesLoading(true);
      try {
        const loaded = await listActivePromotionPackagesForTenant(formValues.tenantId);
        setPromotionPackages(loaded.filter((pkg) => pkg.resourceType === "event"));
      } catch (loadError) {
        console.error("Failed to load promotion packages for Event form:", loadError);
        setPromotionPackages([]);
      } finally {
        setPromotionPackagesLoading(false);
      }
    }

    void loadPromotionPackagesForForm();
  }, [formOpen, formValues.tenantId]);

  function openCreate(): void {
    const defaultTenantId =
      selectedTenantId ||
      tenants.find((t) => t.status === "active")?.tenantId ||
      "";
    setFormValues(createEventFormValues({ tenantId: defaultTenantId, tenantIds: defaultTenantId ? [defaultTenantId] : [] }));
    setSelectedThumbnail(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(event: EventRecord): void {
    setFormValues(mapEventToForm(event));
    setSelectedThumbnail(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function closeForm(): void {
    setFormOpen(false);
    setFormErrors({});
    setSelectedThumbnail(null);
  }

  function updateField<K extends keyof EventFormValues>(
    field: K,
    nextValue: EventFormValues[K],
  ): void {
    setFormValues((prev) => ({ ...prev, [field]: nextValue }));
  }

  function handleThumbnailSelection(file: File | null): void {
    setFormErrors((prev) => ({ ...prev, thumbnailUrl: undefined }));
    if (!file) {
      setSelectedThumbnail(null);
      return;
    }
    const validationError = validateEventThumbnailFile(file);
    if (validationError) {
      setSelectedThumbnail(null);
      setFormErrors((prev) => ({ ...prev, thumbnailUrl: validationError }));
      return;
    }
    setSelectedThumbnail(file);
  }

  async function validatePromotionCreditsForRequester(values: EventFormValues): Promise<string | null> {
    if (!values.promoted || !values.promotionPackageId) {
      return null;
    }

    const role = typeof window !== "undefined" ? sessionStorage.getItem("cs_role") : null;
    const requiresCreditCheck = role === "company" || role === "professional";
    if (!requiresCreditCheck) {
      return null;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      return "Unable to verify wallet. Please sign in again.";
    }

    const wallet = await getWalletByUserAndTenant({ userId: uid, tenantId: values.tenantId });
    const availableCoins = wallet?.availableCoins ?? 0;

    let selectedPackage = promotionPackages.find((pkg) => pkg.id === values.promotionPackageId);
    if (!selectedPackage && values.tenantId) {
      const loaded = await listActivePromotionPackagesForTenant(values.tenantId);
      selectedPackage = loaded.find((pkg) => pkg.resourceType === "event" && pkg.id === values.promotionPackageId);
    }

    if (!selectedPackage) {
      return "Selected promotion package is unavailable.";
    }

    if (availableCoins < selectedPackage.costCredits) {
      return `Not enough credits. Required: ${selectedPackage.costCredits}, Available: ${availableCoins}.`;
    }

    return null;
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      // Determine mode from published checkbox
      const mode: EventSaveMode = formValues.published ? "publish" : "draft";

      // Client-side validation
      const preliminaryErrors = validateEventForm(formValues, mode, {
        hasSelectedThumbnail: Boolean(selectedThumbnail),
      });
      if (Object.keys(preliminaryErrors).length > 0) {
        setFormErrors(preliminaryErrors);
        return;
      }

      const creditValidationError = await validatePromotionCreditsForRequester(formValues);
      if (creditValidationError) {
        setFormErrors((prev) => ({ ...prev, promotionPackageId: creditValidationError }));
        setFormValues((prev) => ({
          ...prev,
          promoted: false,
          promotionStatus: "none",
        }));
        return;
      }

      // isExisting must be captured BEFORE generating a new id
      const isExisting = Boolean(formValues.id);
      const nextId = formValues.id ?? buildEventId();
      let nextThumbnailUrl = formValues.thumbnailUrl;
      let nextThumbnailPath = formValues.thumbnailPath;

      if (selectedThumbnail) {
        setUploadBusy(true);
        const uploadResult = await uploadEventThumbnail({
          tenantId: formValues.tenantIds[0] || formValues.tenantId,
          eventId: nextId,
          file: selectedThumbnail,
        });
        nextThumbnailUrl = uploadResult.thumbnailUrl;
        nextThumbnailPath = uploadResult.thumbnailPath;
      }

      const nextFormValues: EventFormValues = {
        ...formValues,
        id: nextId,
        thumbnailUrl: nextThumbnailUrl,
        thumbnailPath: nextThumbnailPath,
      };

      const payload = normalizeEventForm(nextFormValues, mode);
      await saveEvent(payload, mode, isExisting);

      setFormValues(nextFormValues);
      setFormOpen(false);
      setSelectedThumbnail(null);
      setFormErrors({});

      const action = isExisting ? "updated" : "created";
      const pubStatus = formValues.published ? " and published" : " as draft";
      setMessage(`Event ${action}${pubStatus}.`);

      await refreshEvents(selectedTenantId || undefined);
    } catch (submitError) {
      console.error(submitError);
      const err = submitError as {
        message?: string;
        details?: { fieldErrors?: Record<string, string>; issues?: string[] };
      };

      const fieldErrors = err.details?.fieldErrors ?? {};
      const issues = err.details?.issues ?? [];

      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors((prev) => ({ ...prev, ...fieldErrors }));
        setError("Please fix the highlighted fields.");
      } else if (issues.length > 0) {
        const msg = issues.join(" ");
        setError(msg);
        setFormErrors((prev) => ({ ...prev, form: msg }));
      } else {
        const msg = err.message || "Event save failed.";
        setError(msg);
        setFormErrors((prev) => ({ ...prev, form: msg }));
      }
    } finally {
      setBusy(false);
      setUploadBusy(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Events</h2>
      <p className={styles.subtitle}>
        Create tenant-wide Events for StudioVerse tenants. Publish to make them
        visible; promote to elevate them on the landing page.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <select
            className={styles.select}
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            style={{ minWidth: 220, marginBottom: 0 }}
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.tenantId}>
                {t.tenantName}
              </option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={openCreate}>
            Add Event
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading Events…</div>
      ) : events.length === 0 ? (
        <div className={styles.emptyCard}>
          No Events found for the selected tenant filter.
        </div>
      ) : (
        <>
          <div className={styles.filterPillGroup}>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "all" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "published" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("published")}
            >
              Published
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPublicationState === "draft" ? styles.active : ""}`}
              onClick={() => setSelectedPublicationState("draft")}
            >
              Draft
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${selectedPromoted === "true" ? styles.active : ""}`}
              onClick={() => setSelectedPromoted("true")}
            >
              Promoted
            </button>
          </div>

          <div className={styles.eventGrid}>
            {events
              .filter((event) => {
                if (selectedPublicationState !== "all" && event.publicationState !== selectedPublicationState) {
                  return false;
                }
                if (selectedPromoted === "true" && !event.promoted) {
                  return false;
                }
                return true;
              })
              .map((event) => (
                <article key={event.id} className={styles.eventTile}>
                  <div className={styles.eventImageWrap}>
                    <img
                      className={styles.eventImage}
                      src={event.thumbnailUrl || "/tenants/coaching-studio/hero1.png"}
                      alt={event.name}
                      loading="lazy"
                    />
                  </div>
                  <div className={styles.eventContent}>
                    <p className={styles.eventTitle}>{event.name}</p>
                    {event.shortDescription ? (
                      <p className={styles.eventDescription}>{event.shortDescription}</p>
                    ) : null}
                    <p className={styles.eventMeta}>Type: {EVENT_TYPE_LABELS[event.eventType]}</p>
                    <p className={styles.eventMeta}>Source: {EVENT_SOURCE_LABELS[event.eventSource]}</p>
                    {event.eventDate ? (
                      <p className={styles.eventMeta}>
                        {event.eventDate} {event.eventTime ? `at ${event.eventTime}` : ""}
                      </p>
                    ) : null}
                    {event.locationCity || event.locationAddress ? (
                      <p className={styles.eventMeta}>
                        {event.locationCity} {event.locationAddress}
                      </p>
                    ) : null}
                    <p className={styles.eventMeta}>Visibility: {EVENT_VISIBILITY_LABELS[event.visibility]}</p>
                    <p className={styles.eventMeta}>Promotion: {EVENT_PROMOTION_STATUS_LABELS[event.promotionStatus]}</p>
                  </div>

                  <div className={styles.eventActions}>
                    <span className={styles.statusBadge}>
                      {EVENT_STATUS_LABELS[event.status]}
                    </span>
                    <button
                      type="button"
                      className={styles.rowAction}
                      onClick={() => openEdit(event)}
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </>
      )}

      {formOpen ? (
        <EventForm
          tenants={tenants}
          value={formValues}
          errors={formErrors}
          busy={busy}
          uploadBusy={uploadBusy}
          editing={Boolean(formValues.id)}
          thumbnailName={selectedThumbnail?.name ?? null}
          promotionPackages={promotionPackages}
          promotionPackagesLoading={promotionPackagesLoading}
          onChange={updateField}
          onThumbnailSelect={handleThumbnailSelection}
          onCancel={closeForm}
          onSave={() => void submit()}
        />
      ) : null}
    </article>
  );
}
