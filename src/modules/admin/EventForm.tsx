"use client";

import { useEffect, useRef } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  EVENT_SOURCES,
  EVENT_SOURCE_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  type EventFormValues,
} from "@/types/event";
import type { EventFormErrors } from "@/lib/validation/event.schema";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type EventFormProps = {
  tenants: TenantOption[];
  value: EventFormValues;
  errors: EventFormErrors;
  busy: boolean;
  uploadBusy: boolean;
  editing: boolean;
  thumbnailName: string | null;
  onChange: <K extends keyof EventFormValues>(field: K, nextValue: EventFormValues[K]) => void;
  onThumbnailSelect: (file: File | null) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function EventForm({
  tenants,
  value,
  errors,
  busy,
  uploadBusy,
  editing,
  thumbnailName,
  onChange,
  onThumbnailSelect,
  onCancel,
  onSave,
}: EventFormProps) {
  const activeTenants = tenants.filter((t) => t.status === "active");
  const primaryTenantId = value.tenantId;
  const selectedTenantIds = Array.isArray(value.tenantIds)
    ? value.tenantIds
    : value.tenantId
    ? [value.tenantId]
    : [];
  const selectedTenantIdsWithPrimary = primaryTenantId && !selectedTenantIds.includes(primaryTenantId)
    ? [primaryTenantId, ...selectedTenantIds]
    : selectedTenantIds;

  // ---- Auto-focus first field with an error ----
  const fieldRefs = useRef<
    Partial<Record<keyof EventFormValues, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>
  >({});

  function toggleTenantSelection(tenantId: string): void {
    const current = selectedTenantIdsWithPrimary;
    const hasTenant = current.includes(tenantId);
    const nextTenantIds = hasTenant
      ? current.filter((id) => id !== tenantId)
      : [...current, tenantId];

    if (editing && primaryTenantId) {
      if (!nextTenantIds.includes(primaryTenantId)) {
        return;
      }
      onChange("tenantIds", nextTenantIds);
      onChange("tenantId", primaryTenantId);
      return;
    }

    onChange("tenantIds", nextTenantIds);
    onChange("tenantId", nextTenantIds[0] ?? "");
  }

  useEffect(() => {
    const focusOrder: Array<keyof EventFormValues> = [
      "tenantId",
      "name",
      "eventType",
      "eventSource",
      "shortDescription",
      "longDescription",
      "eventDate",
      "eventTime",
      "locationAddress",
      "locationCity",
      "details",
      "videoUrl",
      "creditsRequired",
      "cost",
      "thumbnailUrl",
      "promoted",
      "published",
    ];
    const first = focusOrder.find((field) => Boolean(errors[field]));
    if (!first) return;
    const el = fieldRefs.current[first];
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errors]);

  return (
    <div className={styles.modalOverlay}>
      <section className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 style={{ margin: 0 }}>{editing ? "Edit Event" : "Create Event"}</h3>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onCancel}
            disabled={busy || uploadBusy}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Tenant */}
          <label className={styles.label} htmlFor="event-tenant">Tenants</label>
          <div
            id="event-tenant"
            className={`${styles.controlCard} ${errors.tenantId ? styles.inputError : ""}`}
          >
            {activeTenants.map((t) => (
              <label key={t.id} className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={selectedTenantIdsWithPrimary.includes(t.tenantId)}
                  onChange={() => toggleTenantSelection(t.tenantId)}
                  disabled={busy}
                />
                <span>{t.tenantName}</span>
              </label>
            ))}
          </div>
          {errors.tenantId ? <p className={styles.error}>{errors.tenantId}</p> : null}

          {/* Name */}
          <label className={styles.label} htmlFor="event-name">Event Name</label>
          <input
            id="event-name"
            ref={(el) => { fieldRefs.current.name = el; }}
            className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
            value={value.name}
            onChange={(e) => onChange("name", e.target.value)}
            disabled={busy}
          />
          {errors.name ? <p className={styles.error}>{errors.name}</p> : null}

          {/* Event type */}
          <label className={styles.label} htmlFor="event-type">Event Type</label>
          <select
            id="event-type"
            ref={(el) => { fieldRefs.current.eventType = el; }}
            className={styles.select}
            value={value.eventType}
            onChange={(e) => onChange("eventType", e.target.value as EventFormValues["eventType"])}
            disabled={busy}
          >
            {EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>{EVENT_TYPE_LABELS[eventType]}</option>
            ))}
          </select>

          {/* Event source */}
          <label className={styles.label} htmlFor="event-source">Event Source</label>
          <select
            id="event-source"
            ref={(el) => { fieldRefs.current.eventSource = el; }}
            className={styles.select}
            value={value.eventSource}
            onChange={(e) => onChange("eventSource", e.target.value as EventFormValues["eventSource"])}
            disabled={busy}
          >
            {EVENT_SOURCES.map((eventSource) => (
              <option key={eventSource} value={eventSource}>{EVENT_SOURCE_LABELS[eventSource]}</option>
            ))}
          </select>

          {/* Short description */}
          <label className={styles.label} htmlFor="event-short-description">Short Description</label>
          <textarea
            id="event-short-description"
            ref={(el) => { fieldRefs.current.shortDescription = el; }}
            className={`${styles.input} ${errors.shortDescription ? styles.inputError : ""}`}
            value={value.shortDescription}
            onChange={(e) => onChange("shortDescription", e.target.value)}
            rows={3}
            disabled={busy}
          />
          {errors.shortDescription ? <p className={styles.error}>{errors.shortDescription}</p> : null}

          {/* Long description */}
          <label className={styles.label} htmlFor="event-long-description">Long Description</label>
          <textarea
            id="event-long-description"
            ref={(el) => { fieldRefs.current.longDescription = el; }}
            className={`${styles.input} ${errors.longDescription ? styles.inputError : ""}`}
            value={value.longDescription}
            onChange={(e) => onChange("longDescription", e.target.value)}
            rows={5}
            disabled={busy}
          />
          {errors.longDescription ? <p className={styles.error}>{errors.longDescription}</p> : null}

          {/* Date + Time row */}
          <div className={styles.actions}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label className={styles.label} htmlFor="event-date">Event Date</label>
              <input
                id="event-date"
                ref={(el) => { fieldRefs.current.eventDate = el; }}
                className={`${styles.input} ${errors.eventDate ? styles.inputError : ""}`}
                type="date"
                value={value.eventDate}
                onChange={(e) => onChange("eventDate", e.target.value)}
                disabled={busy}
              />
              {errors.eventDate ? <p className={styles.error}>{errors.eventDate}</p> : null}
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <label className={styles.label} htmlFor="event-time">Event Time</label>
              <input
                id="event-time"
                ref={(el) => { fieldRefs.current.eventTime = el; }}
                className={`${styles.input} ${errors.eventTime ? styles.inputError : ""}`}
                type="time"
                value={value.eventTime}
                onChange={(e) => onChange("eventTime", e.target.value)}
                disabled={busy}
              />
              {errors.eventTime ? <p className={styles.error}>{errors.eventTime}</p> : null}
            </div>
          </div>

          {/* Location Address + City */}
          <div className={styles.actions}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label className={styles.label} htmlFor="event-location-address">Location Address</label>
              <input
                id="event-location-address"
                ref={(el) => { fieldRefs.current.locationAddress = el; }}
                className={`${styles.input} ${errors.locationAddress ? styles.inputError : ""}`}
                value={value.locationAddress}
                onChange={(e) => onChange("locationAddress", e.target.value)}
                placeholder="Venue address or online meeting location"
                disabled={busy}
              />
              {errors.locationAddress ? <p className={styles.error}>{errors.locationAddress}</p> : null}
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <label className={styles.label} htmlFor="event-location-city">Location City</label>
              <input
                id="event-location-city"
                ref={(el) => { fieldRefs.current.locationCity = el; }}
                className={`${styles.input} ${errors.locationCity ? styles.inputError : ""}`}
                value={value.locationCity}
                onChange={(e) => onChange("locationCity", e.target.value)}
                placeholder="City"
                disabled={busy}
              />
              {errors.locationCity ? <p className={styles.error}>{errors.locationCity}</p> : null}
            </div>
          </div>

          {/* Details */}
          <label className={styles.label} htmlFor="event-details">Details</label>
          <textarea
            id="event-details"
            ref={(el) => { fieldRefs.current.details = el; }}
            className={`${styles.input} ${errors.details ? styles.inputError : ""}`}
            value={value.details}
            onChange={(e) => onChange("details", e.target.value)}
            rows={4}
            disabled={busy}
          />
          {errors.details ? <p className={styles.error}>{errors.details}</p> : null}

          {/* Video URL + Credits + Cost row */}
          <div className={styles.actions}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className={styles.label} htmlFor="event-video-url">Video / Meeting URL</label>
              <input
                id="event-video-url"
                ref={(el) => { fieldRefs.current.videoUrl = el; }}
                className={`${styles.input} ${errors.videoUrl ? styles.inputError : ""}`}
                value={value.videoUrl}
                onChange={(e) => onChange("videoUrl", e.target.value)}
                placeholder="https://"
                disabled={busy}
              />
              {errors.videoUrl ? <p className={styles.error}>{errors.videoUrl}</p> : null}
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className={styles.label} htmlFor="event-credits">Credits Required</label>
              <input
                id="event-credits"
                ref={(el) => { fieldRefs.current.creditsRequired = el; }}
                className={`${styles.input} ${errors.creditsRequired ? styles.inputError : ""}`}
                value={value.creditsRequired}
                onChange={(e) => onChange("creditsRequired", e.target.value)}
                inputMode="numeric"
                disabled={busy}
              />
              {errors.creditsRequired ? <p className={styles.error}>{errors.creditsRequired}</p> : null}
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <label className={styles.label} htmlFor="event-cost">Cost</label>
              <input
                id="event-cost"
                ref={(el) => { fieldRefs.current.cost = el; }}
                className={`${styles.input} ${errors.cost ? styles.inputError : ""}`}
                value={value.cost}
                onChange={(e) => onChange("cost", e.target.value)}
                inputMode="decimal"
                disabled={busy}
              />
              {errors.cost ? <p className={styles.error}>{errors.cost}</p> : null}
            </div>
          </div>

          {/* Thumbnail */}
          <label className={styles.label} htmlFor="event-thumbnail">Thumbnail</label>
          <input
            id="event-thumbnail"
            ref={(el) => { fieldRefs.current.thumbnailUrl = el; }}
            className={`${styles.input} ${errors.thumbnailUrl ? styles.inputError : ""}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onThumbnailSelect(e.target.files?.[0] ?? null)}
            disabled={busy || uploadBusy}
          />
          <p className={styles.subtitle}>
            {thumbnailName
              ? `Selected: ${thumbnailName}`
              : value.thumbnailUrl
                ? "Existing thumbnail will be kept unless you upload a replacement."
                : "Upload a JPG, PNG, or WebP image up to 2MB."}
          </p>
          {errors.thumbnailUrl ? <p className={styles.error}>{errors.thumbnailUrl}</p> : null}

          {/* Promote / Publish toggles */}
          <div className={styles.actions} style={{ alignItems: "center", marginBottom: 12 }}>
            <label className={styles.radioPill}>
              <input
                type="checkbox"
                ref={(el) => { fieldRefs.current.promoted = el; }}
                checked={value.promoted}
                onChange={(e) => onChange("promoted", e.target.checked)}
                disabled={busy}
              />
              Promoted
            </label>
            <label className={styles.radioPill}>
              <input
                type="checkbox"
                ref={(el) => { fieldRefs.current.published = el; }}
                checked={value.published}
                onChange={(e) => onChange("published", e.target.checked)}
                disabled={busy}
              />
              Publish
            </label>
            <span className={styles.statusBadge}>{EVENT_STATUS_LABELS[value.status]}</span>
          </div>

          {/* Promote / Publish info panel (E3 §12.8) */}
          <div className={styles.emptyCard} style={{ marginBottom: 12 }}>
            <p className={styles.userMeta}>
              <strong>Publish</strong> makes this event visible in the tenant event catalog.
            </p>
            <p className={styles.userMeta}>
              <strong>Promote</strong> elevates a <em>published</em> event to the tenant landing page.
              Promotion does not replace publication — both must be true for landing-page placement.
            </p>
            <p className={styles.userMeta}>Ownership Scope: platform · Visibility: tenant_wide</p>
          </div>

          {errors.form ? <p className={styles.error}>{errors.form}</p> : null}
        </div>

        {/* Footer actions */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.ghostButton}
            onClick={onCancel}
            disabled={busy || uploadBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={onSave}
            disabled={busy || uploadBusy}
          >
            {busy || uploadBusy ? "Working…" : editing ? "Update" : "Create"}
          </button>
        </div>
      </section>
    </div>
  );
}
