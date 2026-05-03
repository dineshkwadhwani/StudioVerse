"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  getBotHeroPackageSummary,
  listBotHeroPackages,
  saveBotHeroPackage,
  uploadBotHeroPackageImage,
  validateBotHeroPackageForm,
  validateBotHeroPackageImageFile,
} from "@/services/botHero.service";
import {
  BOT_HERO_DURATION_UNITS,
  BOT_HERO_DURATION_UNIT_LABELS,
  type BotHeroPackageFormValues,
  type BotHeroPackageRecord,
} from "@/types/botHero";

type Props = { operatorId: string };

const EMPTY_FORM: BotHeroPackageFormValues = {
  name: "",
  description: "",
  imageUrl: "",
  imagePath: "",
  durationValue: "",
  durationUnit: "weeks",
  credits: "",
  active: true,
  sortOrder: "",
};

export default function BotHeroPackagesSection({ operatorId }: Props) {
  const [packages, setPackages] = useState<BotHeroPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<BotHeroPackageFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setPackages(await listBotHeroPackages());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function openCreate() {
    setFormValues(EMPTY_FORM);
    setSelectedImage(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  function openEdit(pkg: BotHeroPackageRecord) {
    setFormValues({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? "",
      imageUrl: pkg.imageUrl ?? "",
      imagePath: pkg.imagePath ?? "",
      durationValue: String(pkg.durationValue),
      durationUnit: pkg.durationUnit,
      credits: String(pkg.credits),
      active: pkg.active,
      sortOrder: String(pkg.sortOrder),
    });
    setSelectedImage(null);
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    const errors = validateBotHeroPackageForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const nextValues: BotHeroPackageFormValues = { ...formValues };
      const existingPackage = formValues.id
        ? packages.find((pkg) => pkg.id === formValues.id)
        : undefined;

      if (!selectedImage && existingPackage) {
        nextValues.imageUrl = nextValues.imageUrl || existingPackage.imageUrl || "";
        nextValues.imagePath = nextValues.imagePath || existingPackage.imagePath || "";
      }

      if (selectedImage) {
        setUploadingImage(true);
        const packageId = formValues.id ?? crypto.randomUUID();
        const uploaded = await uploadBotHeroPackageImage({ packageId, file: selectedImage });
        nextValues.id = packageId;
        nextValues.imageUrl = uploaded.imageUrl;
        nextValues.imagePath = uploaded.imagePath;
      }
      await saveBotHeroPackage(nextValues, operatorId);
      setMessage(formValues.id ? "Bot Hero package updated." : "Bot Hero package created.");
      setFormOpen(false);
      setSelectedImage(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Bot Hero package.");
    } finally {
      setUploadingImage(false);
      setSaving(false);
    }
  }

  function handleImageSelection(file: File | null): void {
    setFormErrors((prev) => { const { imageUrl: _, ...rest } = prev; return rest; });
    if (!file) { setSelectedImage(null); return; }
    const imgErr = validateBotHeroPackageImageFile(file);
    if (imgErr) { setSelectedImage(null); setFormErrors((prev) => ({ ...prev, imageUrl: imgErr })); return; }
    setSelectedImage(file);
  }

  function field(key: keyof BotHeroPackageFormValues, value: string | boolean) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => { const { [key]: _removed, ...rest } = prev; return rest; });
  }

  const sorted = [...packages].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article className={styles.card}>
      <h2>Manage Bot Hero Packages</h2>
      <p className={styles.subtitle}>
        Create and manage Bot Hero packages. Coaches purchase these to become the face of the tenant bot for a defined period.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={openCreate}>
            Add Bot Hero Package
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading Bot Hero packages…</div>
      ) : packages.length === 0 ? (
        <div className={styles.emptyCard}>No Bot Hero packages found.</div>
      ) : (
        <div className={styles.programGrid}>
          {sorted.map((pkg) => (
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
                    <span style={{ color: "#134267", fontWeight: 700, fontSize: "0.8rem" }}>Bot Hero</span>
                  </div>
                )}
              </div>
              <div className={styles.programContent}>
                <p className={styles.programTitle}>{pkg.name}</p>
                {pkg.description ? <p className={styles.programDescription}>{pkg.description}</p> : null}
                <p className={styles.programMeta}>{getBotHeroPackageSummary(pkg)}</p>
                <p className={styles.programMeta}>Sort Order: {pkg.sortOrder}</p>
              </div>
              <div className={styles.programActions}>
                <span className={styles.statusBadge}>{pkg.active ? "active" : "inactive"}</span>
                <button type="button" className={styles.rowAction} onClick={() => openEdit(pkg)}>
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen ? (
        <div className={styles.modalOverlay}>
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>{formValues.id ? "Edit Bot Hero Package" : "New Bot Hero Package"}</h3>
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
              <label className={styles.label}>Package Name</label>
              <input
                className={styles.input}
                type="text"
                value={formValues.name}
                onChange={(e) => field("name", e.target.value)}
              />
              {formErrors.name ? <p className={styles.error}>{formErrors.name}</p> : null}

              <label className={styles.label}>Description</label>
              <textarea
                className={styles.input}
                rows={3}
                value={formValues.description}
                onChange={(e) => field("description", e.target.value)}
                style={{ resize: "vertical" }}
              />

              <label className={styles.label}>Image</label>
              <input
                className={styles.input}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleImageSelection(e.target.files?.[0] ?? null)}
                disabled={saving || uploadingImage}
              />
              <p className={styles.subtitle}>
                {selectedImage
                  ? `Selected: ${selectedImage.name}`
                  : formValues.imageUrl
                    ? "Existing image kept unless you upload a replacement."
                    : "Upload a JPG, PNG, or WebP image up to 2MB."}
              </p>
              {formValues.imageUrl && !selectedImage ? (
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => setFormValues((prev) => ({ ...prev, imageUrl: "", imagePath: "" }))}
                  disabled={saving || uploadingImage}
                  style={{ marginBottom: "12px" }}
                >
                  Remove current image
                </button>
              ) : null}
              {formErrors.imageUrl ? <p className={styles.error}>{formErrors.imageUrl}</p> : null}
              {formValues.imageUrl ? (
                <div style={{ marginBottom: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={formValues.imageUrl} alt="Package preview" style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid #c6dcea" }} />
                </div>
              ) : null}

              <div className={styles.actions}>
                <div>
                  <label className={styles.label}>Duration Value</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={formValues.durationValue}
                    onChange={(e) => field("durationValue", e.target.value)}
                  />
                  {formErrors.durationValue ? <p className={styles.error}>{formErrors.durationValue}</p> : null}
                </div>

                <div>
                  <label className={styles.label}>Duration Unit</label>
                  <select
                    className={styles.select}
                    value={formValues.durationUnit}
                    onChange={(e) => field("durationUnit", e.target.value)}
                  >
                    {BOT_HERO_DURATION_UNITS.map((u) => (
                      <option key={u} value={u}>{BOT_HERO_DURATION_UNIT_LABELS[u]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={styles.label}>Credits (cost)</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={formValues.credits}
                    onChange={(e) => field("credits", e.target.value)}
                  />
                  {formErrors.credits ? <p className={styles.error}>{formErrors.credits}</p> : null}
                </div>

                <div>
                  <label className={styles.label}>Sort Order</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={formValues.sortOrder}
                    onChange={(e) => field("sortOrder", e.target.value)}
                  />
                </div>

                <div>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={formValues.active ? "active" : "inactive"}
                    onChange={(e) => field("active", e.target.value === "active")}
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
              <button type="button" className={styles.button} onClick={() => void handleSave()} disabled={saving || uploadingImage}>
                {saving || uploadingImage ? "Saving…" : formValues.id ? "Update Bot Hero Package" : "Create Bot Hero Package"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
