"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  getBotHeroPackageSummary,
  listBotHeroPackages,
  saveBotHeroPackage,
  validateBotHeroPackageForm,
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
      durationValue: String(pkg.durationValue),
      durationUnit: pkg.durationUnit,
      credits: String(pkg.credits),
      active: pkg.active,
      sortOrder: String(pkg.sortOrder),
    });
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
      await saveBotHeroPackage(formValues, operatorId);
      setMessage(formValues.id ? "Bot Hero package updated." : "Bot Hero package created.");
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Bot Hero package.");
    } finally {
      setSaving(false);
    }
  }

  function field(key: keyof BotHeroPackageFormValues, value: string | boolean) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => { const { [key]: _removed, ...rest } = prev; return rest; });
  }

  return (
    <article className={styles.card}>
      <h2>Manage Bot Hero Packages</h2>
      <p className={styles.subtitle}>
        Create and manage Bot Hero packages. Coaches purchase these packages to become the face of the tenant bot for a defined period.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={openCreate}>
            + New Bot Hero Package
          </button>
        </div>
      </div>

      {message && <p className={styles.successMessage}>{message}</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}

      {formOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{formValues.id ? "Edit Bot Hero Package" : "New Bot Hero Package"}</h3>

            <label className={styles.formField}>
              <span className={styles.formLabel}>Package Name *</span>
              <input className={styles.formInput} value={formValues.name} onChange={(e) => field("name", e.target.value)} />
              {formErrors.name && <span className={styles.fieldError}>{formErrors.name}</span>}
            </label>

            <label className={styles.formField}>
              <span className={styles.formLabel}>Description</span>
              <textarea className={styles.formTextarea} value={formValues.description} onChange={(e) => field("description", e.target.value)} rows={2} />
            </label>

            <div className={styles.formRow}>
              <label className={styles.formField}>
                <span className={styles.formLabel}>Duration *</span>
                <input
                  type="number"
                  className={styles.formInput}
                  min={1}
                  value={formValues.durationValue}
                  onChange={(e) => field("durationValue", e.target.value)}
                />
                {formErrors.durationValue && <span className={styles.fieldError}>{formErrors.durationValue}</span>}
              </label>

              <label className={styles.formField}>
                <span className={styles.formLabel}>Unit</span>
                <select
                  className={styles.formSelect}
                  value={formValues.durationUnit}
                  onChange={(e) => field("durationUnit", e.target.value)}
                >
                  {BOT_HERO_DURATION_UNITS.map((u) => (
                    <option key={u} value={u}>{BOT_HERO_DURATION_UNIT_LABELS[u]}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className={styles.formField}>
              <span className={styles.formLabel}>Credits (cost) *</span>
              <input
                type="number"
                className={styles.formInput}
                min={1}
                value={formValues.credits}
                onChange={(e) => field("credits", e.target.value)}
              />
              {formErrors.credits && <span className={styles.fieldError}>{formErrors.credits}</span>}
            </label>

            <label className={styles.formField}>
              <span className={styles.formLabel}>Sort Order</span>
              <input type="number" className={styles.formInput} value={formValues.sortOrder} onChange={(e) => field("sortOrder", e.target.value)} />
            </label>

            <label className={styles.checkboxField}>
              <input type="checkbox" checked={formValues.active} onChange={(e) => field("active", e.target.checked)} />
              <span>Active (visible to coaches)</span>
            </label>

            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className={styles.primaryBtn} onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving..." : "Save Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loadingText}>Loading packages…</p>
      ) : packages.length === 0 ? (
        <div className={styles.emptyCard}>No Bot Hero packages yet. Create one to get started.</div>
      ) : (
        <div className={styles.packageGrid}>
          {packages.map((pkg) => (
            <div key={pkg.id} className={styles.packageCard}>
              <div className={styles.packageCardHeader}>
                <span className={styles.packageName}>{pkg.name}</span>
                <span className={pkg.active ? styles.statusBadgeActive : styles.statusBadgeInactive}>
                  {pkg.active ? "Active" : "Inactive"}
                </span>
              </div>
              {pkg.description && <p className={styles.packageDesc}>{pkg.description}</p>}
              <p className={styles.packageMeta}>{getBotHeroPackageSummary(pkg)}</p>
              <button type="button" className={styles.editBtn} onClick={() => openEdit(pkg)}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
