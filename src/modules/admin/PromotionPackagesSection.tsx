"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import styles from "./SuperAdminPortal.module.css";
import {
  getPromotionPackageSummary,
  listPromotionPackages,
  savePromotionPackage,
  uploadPromotionPackageImage,
  validatePromotionPackageImageFile,
  validatePromotionPackageForm,
} from "@/services/promotionPackages.service";
import {
  PROMOTION_DURATION_UNIT_LABELS,
  PROMOTION_PACKAGE_DURATION_UNITS,
  PROMOTION_PACKAGE_RESOURCE_TYPES,
  PROMOTION_RESOURCE_LABELS,
  type PromotionPackageFormValues,
  type PromotionPackageRecord,
} from "@/types/promotionPackage";

type Props = {
  operatorId: string;
};

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
  status: string;
};

const EMPTY_FORM: PromotionPackageFormValues = {
  tenantId: "",
  name: "",
  description: "",
  imageUrl: "",
  imagePath: "",
  resourceType: "program",
  durationValue: "",
  durationUnit: "weeks",
  costCredits: "",
  status: "active",
  sortOrder: "",
};

export default function PromotionPackagesSection({ operatorId }: Props) {
  const [packages, setPackages] = useState<PromotionPackageRecord[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [resourceFilter, setResourceFilter] = useState<"all" | PromotionPackageRecord["resourceType"]>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<PromotionPackageFormValues>(EMPTY_FORM);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTenants(): Promise<void> {
    try {
      const q = query(collection(db, "tenants"), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const loadedTenants: TenantOption[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        tenantId: String(doc.data().tenantId ?? ""),
        tenantName: String(doc.data().tenantName ?? doc.data().tenantId ?? doc.id),
        status: String(doc.data().status ?? "inactive"),
      }));
      setTenants(loadedTenants);
    } catch (loadError) {
      console.error("Failed to load tenants:", loadError);
      setError("Could not load tenants.");
    }
  }

  async function refresh() {
    setLoading(true);
    try {
      setPackages(await listPromotionPackages());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    void refresh();
  }, []);

  function openCreate() {
    const defaultTenantId = tenants.find((tenant) => tenant.status === "active")?.tenantId || "";
    setFormValues({ ...EMPTY_FORM, tenantId: defaultTenantId });
    setSelectedImage(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(pkg: PromotionPackageRecord) {
    setFormValues({
      id: pkg.id,
      tenantId: pkg.tenantId,
      name: pkg.name,
      description: pkg.description ?? "",
      imageUrl: pkg.imageUrl ?? "",
      imagePath: pkg.imagePath ?? "",
      resourceType: pkg.resourceType,
      durationValue: String(pkg.durationValue),
      durationUnit: pkg.durationUnit,
      costCredits: String(pkg.costCredits),
      status: pkg.status,
      sortOrder: String(pkg.sortOrder),
    });
    setSelectedImage(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    const errors = validatePromotionPackageForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const nextValues: PromotionPackageFormValues = { ...formValues };

      if (selectedImage) {
        setUploadingImage(true);
        const packageId = formValues.id ?? crypto.randomUUID();
        const imageUpload = await uploadPromotionPackageImage({
          tenantId: formValues.tenantId,
          packageId,
          file: selectedImage,
        });
        nextValues.id = packageId;
        nextValues.imageUrl = imageUpload.imageUrl;
        nextValues.imagePath = imageUpload.imagePath;
      }

      await savePromotionPackage(nextValues, operatorId);
      setMessage(formValues.id ? "Promotion package updated." : "Promotion package created.");
      setFormOpen(false);
      setSelectedImage(null);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save promotion package.");
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  }

  function handleImageSelection(file: File | null): void {
    setFormErrors((previous) => {
      const { imageUrl: _imageUrl, ...rest } = previous;
      return rest;
    });

    if (!file) {
      setSelectedImage(null);
      return;
    }

    const fileError = validatePromotionPackageImageFile(file);
    if (fileError) {
      setSelectedImage(null);
      setFormErrors((previous) => ({ ...previous, imageUrl: fileError }));
      return;
    }

    setSelectedImage(file);
  }

  const filteredPackages = packages
    .filter((pkg) => resourceFilter === "all" || pkg.resourceType === resourceFilter)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article className={styles.card}>
      <h2>Manage Promotion Packages</h2>
      <p className={styles.subtitle}>
        Configure tenant-level promotion packages for Programs now, and Events/Assessments in later phases.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={openCreate}>
            Add Promotion Package
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading promotion packages…</div>
      ) : packages.length === 0 ? (
        <div className={styles.emptyCard}>No promotion packages found.</div>
      ) : (
        <>
          <div className={styles.filterPillGroup}>
            <button
              type="button"
              className={`${styles.filterPill} ${resourceFilter === "all" ? styles.active : ""}`}
              onClick={() => setResourceFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${resourceFilter === "program" ? styles.active : ""}`}
              onClick={() => setResourceFilter("program")}
            >
              Program
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${resourceFilter === "event" ? styles.active : ""}`}
              onClick={() => setResourceFilter("event")}
            >
              Event
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${resourceFilter === "assessment" ? styles.active : ""}`}
              onClick={() => setResourceFilter("assessment")}
            >
              Assessment
            </button>
          </div>

          <div className={styles.programGrid}>
            {filteredPackages.map((pkg) => (
              <article key={pkg.id} className={styles.programTile}>
                <div className={styles.programImageWrap}>
                  {pkg.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.programImage} src={pkg.imageUrl} alt={pkg.name} loading="lazy" />
                  ) : (
                    <div
                      className={styles.programImage}
                      style={{ background: "#d6eaf8", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <span style={{ color: "#134267", fontWeight: 700, fontSize: "0.8rem" }}>
                        {PROMOTION_RESOURCE_LABELS[pkg.resourceType]}
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.programContent}>
                  <p className={styles.programTitle}>{pkg.name}</p>
                  {pkg.description ? <p className={styles.programDescription}>{pkg.description}</p> : null}
                  <p className={styles.programMeta}>Tenant: {pkg.tenantId}</p>
                  <p className={styles.programMeta}>{getPromotionPackageSummary(pkg)}</p>
                  <p className={styles.programMeta}>Duration Unit: {PROMOTION_DURATION_UNIT_LABELS[pkg.durationUnit]}</p>
                </div>
                <div className={styles.programActions}>
                  <span className={styles.statusBadge}>{pkg.status}</span>
                  <button type="button" className={styles.rowAction} onClick={() => openEdit(pkg)}>
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {formOpen ? (
        <div className={styles.modalOverlay}>
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{formValues.id ? "Edit Promotion Package" : "New Promotion Package"}</h3>
              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setFormOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              <label className={styles.label}>Tenant</label>
              <select
                className={styles.select}
                value={formValues.tenantId}
                onChange={(event) => setFormValues((prev) => ({ ...prev, tenantId: event.target.value }))}
              >
                <option value="">Select tenant</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.tenantId}>
                    {tenant.tenantName}
                  </option>
                ))}
              </select>
              {formErrors.tenantId ? <p className={styles.error}>{formErrors.tenantId}</p> : null}

              <label className={styles.label}>Package Name</label>
              <input
                className={styles.input}
                type="text"
                value={formValues.name}
                onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              />
              {formErrors.name ? <p className={styles.error}>{formErrors.name}</p> : null}

              <label className={styles.label}>Description</label>
              <textarea
                className={styles.input}
                rows={3}
                value={formValues.description}
                onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
                style={{ resize: "vertical" }}
              />

              <label className={styles.label}>Image</label>
              <input
                className={styles.input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleImageSelection(event.target.files?.[0] ?? null)}
                disabled={saving || uploadingImage}
              />
              <p className={styles.subtitle}>
                {selectedImage
                  ? `Selected image: ${selectedImage.name}`
                  : formValues.imageUrl
                    ? "Existing image will be kept unless you upload a replacement."
                    : "Upload a JPG, PNG, or WebP image up to 2MB."}
              </p>
              {formErrors.imageUrl ? <p className={styles.error}>{formErrors.imageUrl}</p> : null}
              {formValues.imageUrl ? (
                <div style={{ marginBottom: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formValues.imageUrl}
                    alt="Promotion package preview"
                    style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid #c6dcea" }}
                  />
                </div>
              ) : null}

              <div className={styles.actions}>
                <div>
                  <label className={styles.label}>Promotion Resource</label>
                  <select
                    className={styles.select}
                    value={formValues.resourceType}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        resourceType: event.target.value as PromotionPackageFormValues["resourceType"],
                      }))
                    }
                  >
                    {PROMOTION_PACKAGE_RESOURCE_TYPES.map((resourceType) => (
                      <option key={resourceType} value={resourceType}>
                        {PROMOTION_RESOURCE_LABELS[resourceType]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.label}>Duration Value</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={formValues.durationValue}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, durationValue: event.target.value }))}
                  />
                  {formErrors.durationValue ? <p className={styles.error}>{formErrors.durationValue}</p> : null}
                </div>

                <div>
                  <label className={styles.label}>Duration Unit</label>
                  <select
                    className={styles.select}
                    value={formValues.durationUnit}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        durationUnit: event.target.value as PromotionPackageFormValues["durationUnit"],
                      }))
                    }
                  >
                    {PROMOTION_PACKAGE_DURATION_UNITS.map((durationUnit) => (
                      <option key={durationUnit} value={durationUnit}>
                        {PROMOTION_DURATION_UNIT_LABELS[durationUnit]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.label}>Promotion Cost (Credits)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={formValues.costCredits}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, costCredits: event.target.value }))}
                  />
                  {formErrors.costCredits ? <p className={styles.error}>{formErrors.costCredits}</p> : null}
                </div>

                <div>
                  <label className={styles.label}>Sort Order</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={formValues.sortOrder}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  />
                </div>

                <div>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={formValues.status}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, status: event.target.value as PromotionPackageFormValues["status"] }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.actions} style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #c6dcea" }}>
              <button type="button" className={styles.ghostButton} onClick={() => setFormOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={styles.button} onClick={handleSave} disabled={saving || uploadingImage}>
                {saving || uploadingImage ? "Saving…" : formValues.id ? "Update Promotion Package" : "Create Promotion Package"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
