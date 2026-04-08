"use client";

import { useEffect, useRef } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  PROGRAM_DELIVERY_TYPES,
  PROGRAM_DELIVERY_TYPE_LABELS,
  PROGRAM_DURATION_UNITS,
  PROGRAM_DURATION_UNIT_LABELS,
  PROGRAM_STATUS_LABELS,
  type ProgramFormValues,
  type ProgramFormValues as ProgramValues,
} from "@/types/program";
import type {ProgramFormErrors} from "@/lib/validation/program.schema";

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

type ProgramFormProps = {
  tenants: TenantOption[];
  value: ProgramValues;
  errors: ProgramFormErrors;
  busy: boolean;
  uploadBusy: boolean;
  editing: boolean;
  thumbnailName: string | null;
  onChange: <K extends keyof ProgramFormValues>(field: K, nextValue: ProgramFormValues[K]) => void;
  onThumbnailSelect: (file: File | null) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function ProgramForm({
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
}: ProgramFormProps) {
  const activeTenants = tenants.filter((tenant) => tenant.status === "active");
  const fieldRefs = useRef<
    Partial<Record<keyof ProgramFormValues, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>
  >({});

  useEffect(() => {
    const focusOrder: Array<keyof ProgramFormValues> = [
      "tenantId",
      "name",
      "shortDescription",
      "longDescription",
      "durationValue",
      "details",
      "videoUrl",
      "creditsRequired",
      "availableFrom",
      "expiresAt",
      "facilitatorName",
      "thumbnailUrl",
      "promoted",
      "published",
    ];

    const firstFieldWithError = focusOrder.find((field) => Boolean(errors[field]));
    if (!firstFieldWithError) {
      return;
    }

    const element = fieldRefs.current[firstFieldWithError];
    if (element) {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errors]);

  return (
    <div className={styles.modalOverlay}>
      <section className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 style={{ margin: 0 }}>{editing ? "Edit Program" : "Create Program"}</h3>
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
        <label className={styles.label} htmlFor="program-tenant">
          Tenant
        </label>
        <select
          id="program-tenant"
          ref={(element) => {
            fieldRefs.current.tenantId = element;
          }}
          className={`${styles.select} ${errors.tenantId ? styles.inputError : ""}`}
          value={value.tenantId}
          onChange={(event) => onChange("tenantId", event.target.value)}
          disabled={busy || editing}
        >
          <option value="">Select a tenant</option>
          {activeTenants.map((tenant) => (
            <option key={tenant.id} value={tenant.tenantId}>
              {tenant.tenantName}
            </option>
          ))}
        </select>
        {errors.tenantId ? <p className={styles.error}>{errors.tenantId}</p> : null}

        <label className={styles.label} htmlFor="program-name">
          Program Name
        </label>
        <input
          id="program-name"
          ref={(element) => {
            fieldRefs.current.name = element;
          }}
          className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
          value={value.name}
          onChange={(event) => onChange("name", event.target.value)}
          disabled={busy}
        />
        {errors.name ? <p className={styles.error}>{errors.name}</p> : null}

        <label className={styles.label} htmlFor="program-short-description">
          Short Description
        </label>
        <textarea
          id="program-short-description"
          ref={(element) => {
            fieldRefs.current.shortDescription = element;
          }}
          className={`${styles.input} ${errors.shortDescription ? styles.inputError : ""}`}
          value={value.shortDescription}
          onChange={(event) => onChange("shortDescription", event.target.value)}
          rows={3}
          disabled={busy}
        />
        {errors.shortDescription ? <p className={styles.error}>{errors.shortDescription}</p> : null}

        <label className={styles.label} htmlFor="program-long-description">
          Long Description
        </label>
        <textarea
          id="program-long-description"
          ref={(element) => {
            fieldRefs.current.longDescription = element;
          }}
          className={`${styles.input} ${errors.longDescription ? styles.inputError : ""}`}
          value={value.longDescription}
          onChange={(event) => onChange("longDescription", event.target.value)}
          rows={5}
          disabled={busy}
        />
        {errors.longDescription ? <p className={styles.error}>{errors.longDescription}</p> : null}

        <label className={styles.label} htmlFor="program-delivery-type">
          Delivery Type
        </label>
        <select
          id="program-delivery-type"
          className={styles.select}
          value={value.deliveryType}
          onChange={(event) => onChange("deliveryType", event.target.value as ProgramFormValues["deliveryType"])}
          disabled={busy}
        >
          {PROGRAM_DELIVERY_TYPES.map((deliveryType) => (
            <option key={deliveryType} value={deliveryType}>
              {PROGRAM_DELIVERY_TYPE_LABELS[deliveryType]}
            </option>
          ))}
        </select>

        <div className={styles.actions}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className={styles.label} htmlFor="program-duration-value">
              Duration Value
            </label>
            <input
              id="program-duration-value"
              ref={(element) => {
                fieldRefs.current.durationValue = element;
              }}
              className={styles.input}
              value={value.durationValue}
              onChange={(event) => onChange("durationValue", event.target.value)}
              inputMode="numeric"
              disabled={busy}
            />
            {errors.durationValue ? <p className={styles.error}>{errors.durationValue}</p> : null}
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <label className={styles.label} htmlFor="program-duration-unit">
              Duration Unit
            </label>
            <select
              id="program-duration-unit"
              className={styles.select}
              value={value.durationUnit}
              onChange={(event) => onChange("durationUnit", event.target.value as ProgramFormValues["durationUnit"])}
              disabled={busy}
            >
              {PROGRAM_DURATION_UNITS.map((durationUnit) => (
                <option key={durationUnit} value={durationUnit}>
                  {PROGRAM_DURATION_UNIT_LABELS[durationUnit]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className={styles.label} htmlFor="program-details">
          Details
        </label>
        <textarea
          id="program-details"
          ref={(element) => {
            fieldRefs.current.details = element;
          }}
          className={`${styles.input} ${errors.details ? styles.inputError : ""}`}
          value={value.details}
          onChange={(event) => onChange("details", event.target.value)}
          rows={4}
          disabled={busy}
        />
        {errors.details ? <p className={styles.error}>{errors.details}</p> : null}

        <div className={styles.actions}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className={styles.label} htmlFor="program-video-url">
              Video URL
            </label>
            <input
              id="program-video-url"
              ref={(element) => {
                fieldRefs.current.videoUrl = element;
              }}
              className={styles.input}
              value={value.videoUrl}
              onChange={(event) => onChange("videoUrl", event.target.value)}
              disabled={busy}
            />
            {errors.videoUrl ? <p className={styles.error}>{errors.videoUrl}</p> : null}
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label className={styles.label} htmlFor="program-credits-required">
              Credits Required
            </label>
            <input
              id="program-credits-required"
              ref={(element) => {
                fieldRefs.current.creditsRequired = element;
              }}
              className={`${styles.input} ${errors.creditsRequired ? styles.inputError : ""}`}
              value={value.creditsRequired}
              onChange={(event) => onChange("creditsRequired", event.target.value)}
              inputMode="numeric"
              disabled={busy}
            />
            {errors.creditsRequired ? <p className={styles.error}>{errors.creditsRequired}</p> : null}
          </div>
        </div>

        <div className={styles.actions}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className={styles.label} htmlFor="program-available-from">
              Available From
            </label>
            <input
              id="program-available-from"
              ref={(element) => {
                fieldRefs.current.availableFrom = element;
              }}
              className={`${styles.input} ${errors.availableFrom ? styles.inputError : ""}`}
              type="date"
              value={value.availableFrom}
              onChange={(event) => onChange("availableFrom", event.target.value)}
              disabled={busy}
            />
            {errors.availableFrom ? <p className={styles.error}>{errors.availableFrom}</p> : null}
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label className={styles.label} htmlFor="program-expires-at">
              Expires At
            </label>
            <input
              id="program-expires-at"
              ref={(element) => {
                fieldRefs.current.expiresAt = element;
              }}
              className={`${styles.input} ${errors.expiresAt ? styles.inputError : ""}`}
              type="date"
              value={value.expiresAt}
              onChange={(event) => onChange("expiresAt", event.target.value)}
              disabled={busy}
            />
            {errors.expiresAt ? <p className={styles.error}>{errors.expiresAt}</p> : null}
          </div>
        </div>

        <label className={styles.label} htmlFor="program-facilitator-name">
          Facilitator Name
        </label>
        <input
          id="program-facilitator-name"
          ref={(element) => {
            fieldRefs.current.facilitatorName = element;
          }}
          className={styles.input}
          value={value.facilitatorName}
          onChange={(event) => onChange("facilitatorName", event.target.value)}
          disabled={busy}
        />

        <label className={styles.label} htmlFor="program-thumbnail">
          Thumbnail
        </label>
        <input
          id="program-thumbnail"
          ref={(element) => {
            fieldRefs.current.thumbnailUrl = element;
          }}
          className={`${styles.input} ${errors.thumbnailUrl ? styles.inputError : ""}`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => onThumbnailSelect(event.target.files?.[0] ?? null)}
          disabled={busy || uploadBusy}
        />
        <p className={styles.subtitle}>
          {thumbnailName
            ? `Selected thumbnail: ${thumbnailName}`
            : value.thumbnailUrl
              ? "Existing thumbnail will be kept unless you upload a replacement."
              : "Upload a JPG, PNG, or WebP image up to 2MB."}
        </p>
        {errors.thumbnailUrl ? <p className={styles.error}>{errors.thumbnailUrl}</p> : null}

        <div className={styles.actions} style={{ alignItems: "center", marginBottom: 12 }}>
          <label className={styles.radioPill}>
            <input
              type="checkbox"
              ref={(element) => {
                fieldRefs.current.promoted = element;
              }}
              checked={value.promoted}
              onChange={(event) => onChange("promoted", event.target.checked)}
              disabled={busy}
            />
            Promoted metadata flag
          </label>
          <label className={styles.radioPill}>
            <input
              type="checkbox"
              ref={(element) => {
                fieldRefs.current.published = element;
              }}
              checked={value.published}
              onChange={(event) => onChange("published", event.target.checked)}
              disabled={busy}
            />
            Publish
          </label>
          <span className={styles.statusBadge}>{PROGRAM_STATUS_LABELS[value.status]}</span>
        </div>

        <div className={styles.emptyCard} style={{ marginBottom: 12 }}>
          <p className={styles.userMeta}>Ownership Scope: platform</p>
          <p className={styles.userMeta}>Catalog Visibility: tenant_wide</p>
          <p className={styles.userMeta}>Publication workflow is draft or published only in this epic.</p>
        </div>

        {errors.form ? <p className={styles.error}>{errors.form}</p> : null}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onCancel} disabled={busy || uploadBusy}>
            Cancel
          </button>
          <button type="button" className={styles.button} onClick={onSave} disabled={busy || uploadBusy}>
            {busy || uploadBusy ? "Working..." : editing ? "Update" : "Create"}
          </button>
        </div>
      </section>
    </div>
  );
}
