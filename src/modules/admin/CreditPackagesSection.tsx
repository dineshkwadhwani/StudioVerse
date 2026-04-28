"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  listCoinPackages,
  saveCoinPackage,
  validateCoinPackageForm,
} from "@/services/coinPackages.service";
import { DEFAULT_COIN_PACKAGES } from "@/types/coinPackage";
import type { CoinPackageFormValues, CoinPackageRecord } from "@/types/coinPackage";

const EMPTY_FORM: CoinPackageFormValues = {
  name: "",
  description: "",
  imageUrl: "",
  credits: "",
  priceInr: "",
  status: "active",
  sortOrder: "",
};

type Props = {
  operatorId: string;
};

export default function CreditPackagesSection({ operatorId }: Props) {
  const [packages, setPackages] = useState<CoinPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CoinPackageFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  async function refresh() {
    setLoading(true);
    try {
      setPackages(await listCoinPackages());
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

  function openEdit(pkg: CoinPackageRecord) {
    setFormValues({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? "",
      imageUrl: pkg.imageUrl ?? "",
      credits: String(pkg.credits),
      priceInr: String(pkg.priceInr),
      status: pkg.status,
      sortOrder: String(pkg.sortOrder),
    });
    setFormErrors({});
    setMessage("");
    setError("");
    setFormOpen(true);
  }

  async function handleSave() {
    const errors = validateCoinPackageForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCoinPackage(formValues, operatorId);
      setMessage(formValues.id ? "Credit package updated." : "Credit package created.");
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save credit package.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeedDefaults() {
    setSeeding(true);
    setError("");
    try {
      for (const pkg of DEFAULT_COIN_PACKAGES) {
        await saveCoinPackage(
          {
            name: pkg.name,
            description: pkg.description ?? "",
            imageUrl: "",
            credits: String(pkg.credits),
            priceInr: String(pkg.priceInr),
            status: pkg.status,
            sortOrder: String(pkg.sortOrder),
          },
          operatorId
        );
      }
      setMessage("Default packages seeded successfully.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seeding failed.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Credit Packages</h2>
      <p className={styles.subtitle}>
        Create and manage purchasable credit packages shown on the Buy Coins page.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          {packages.length === 0 ? (
            <button
              type="button"
              className={styles.button}
              onClick={handleSeedDefaults}
              disabled={seeding}
            >
              {seeding ? "Seeding…" : "Seed Defaults"}
            </button>
          ) : null}
          <button type="button" className={styles.button} onClick={openCreate}>
            Add Credit Package
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading credit packages…</div>
      ) : packages.length === 0 ? (
        <div className={styles.emptyCard}>No credit packages yet. Create one above or seed the defaults.</div>
      ) : (
        <>
          <div className={styles.filterPillGroup}>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === "all" ? styles.active : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === "active" ? styles.active : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </button>
            <button
              type="button"
              className={`${styles.filterPill} ${statusFilter === "inactive" ? styles.active : ""}`}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive
            </button>
          </div>

          <div className={styles.programGrid}>
            {packages
              .filter((pkg) => statusFilter === "all" || pkg.status === statusFilter)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((pkg) => (
                <article key={pkg.id} className={styles.programTile}>
                  <div className={styles.programImageWrap}>
                    {pkg.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className={styles.programImage}
                        src={pkg.imageUrl}
                        alt={pkg.name}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={styles.programImage}
                        style={{ background: "#c6dcea", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <span style={{ color: "#4d6e86", fontSize: "0.75rem" }}>No image</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.programContent}>
                    <p className={styles.programTitle}>{pkg.name}</p>
                    {pkg.description ? (
                      <p className={styles.programDescription}>{pkg.description}</p>
                    ) : null}
                    <p className={styles.programMeta}>Credits: {pkg.credits}</p>
                    <p className={styles.programMeta}>Price: ₹{pkg.priceInr.toLocaleString("en-IN")}</p>
                    <p className={styles.programMeta}>Sort Order: {pkg.sortOrder}</p>
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
              <h3 style={{ margin: 0 }}>{formValues.id ? "Edit Credit Package" : "New Credit Package"}</h3>
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
              <label className={styles.label}>Credit Package Name</label>
              <input
                className={styles.input}
                type="text"
                value={formValues.name}
                onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
              />
              {formErrors.name ? <p className={styles.error}>{formErrors.name}</p> : null}

              <label className={styles.label}>Description</label>
              <input
                className={styles.input}
                type="text"
                value={formValues.description}
                onChange={(e) => setFormValues((prev) => ({ ...prev, description: e.target.value }))}
              />
              {formErrors.description ? <p className={styles.error}>{formErrors.description}</p> : null}

              <label className={styles.label}>Image URL</label>
              <p style={{ fontSize: "0.8rem", color: "#4d6e86", margin: "0 0 4px" }}>
                Paste a public image URL for the credit package card (optional)
              </p>
              <input
                className={styles.input}
                type="url"
                value={formValues.imageUrl}
                onChange={(e) => setFormValues((prev) => ({ ...prev, imageUrl: e.target.value }))}
              />
              {formErrors.imageUrl ? <p className={styles.error}>{formErrors.imageUrl}</p> : null}

              {formValues.imageUrl ? (
                <div style={{ marginBottom: "12px" }}>
                  <p className={styles.label} style={{ marginBottom: "6px" }}>Image Preview</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formValues.imageUrl}
                    alt="Credit package preview"
                    style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid #c6dcea" }}
                  />
                </div>
              ) : null}

              <div className={styles.actions}>
                <div>
                  <label className={styles.label}>Credits</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={formValues.credits}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, credits: e.target.value }))}
                  />
                  {formErrors.credits ? <p className={styles.error}>{formErrors.credits}</p> : null}
                </div>
                <div>
                  <label className={styles.label}>Price (₹)</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={formValues.priceInr}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, priceInr: e.target.value }))}
                  />
                  {formErrors.priceInr ? <p className={styles.error}>{formErrors.priceInr}</p> : null}
                </div>
                <div>
                  <label className={styles.label}>Sort Order</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={formValues.sortOrder}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                  {formErrors.sortOrder ? <p className={styles.error}>{formErrors.sortOrder}</p> : null}
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={formValues.status}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, status: e.target.value as "active" | "inactive" }))
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
              <button type="button" className={styles.button} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : formValues.id ? "Update Credit Package" : "Create Credit Package"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}
