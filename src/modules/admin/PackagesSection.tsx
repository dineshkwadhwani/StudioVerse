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

export default function PackagesSection({ operatorId }: Props) {
  const [packages, setPackages] = useState<CoinPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CoinPackageFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setMessage(formValues.id ? "Package updated." : "Package created.");
      setFormOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save package.");
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

  function field(key: keyof CoinPackageFormValues, label: string, type = "text", hint?: string) {
    return (
      <div className={styles.formGroup}>
        <label className={styles.label}>{label}</label>
        {hint ? <p style={{ fontSize: "0.8rem", color: "#4d6e86", margin: "0 0 4px" }}>{hint}</p> : null}
        <input
          type={type}
          className={styles.input}
          value={formValues[key] as string}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        {formErrors[key] ? <p className={styles.fieldError}>{formErrors[key]}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.sectionWrap}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Coin Packages</h2>
          <p className={styles.sectionSub}>
            Create and manage purchasable coin packages shown on the Buy Coins page.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {packages.length === 0 ? (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleSeedDefaults}
              disabled={seeding}
            >
              {seeding ? "Seeding…" : "Seed Defaults"}
            </button>
          ) : null}
          <button type="button" className={styles.primaryButton} onClick={openCreate}>
            + New Package
          </button>
        </div>
      </div>

      {message ? <p className={styles.successMsg}>{message}</p> : null}
      {error ? <p className={styles.errorMsg}>{error}</p> : null}

      {formOpen ? (
        <div className={styles.formCard}>
          <h3 className={styles.formTitle}>{formValues.id ? "Edit Package" : "New Package"}</h3>
          <div className={styles.formGrid}>
            {field("name", "Package Name")}
            {field("description", "Description")}
            {field("imageUrl", "Image URL", "url", "Paste a public image URL for the package card (optional)")}
            {formValues.imageUrl ? (
              <div className={styles.formGroup} style={{ gridColumn: "1 / -1" }}>
                <p className={styles.label} style={{ marginBottom: "6px" }}>Image Preview</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formValues.imageUrl}
                  alt="Package preview"
                  style={{ height: "80px", borderRadius: "10px", objectFit: "cover", border: "1px solid #c6dcea" }}
                />
              </div>
            ) : null}
            {field("credits", "Credits", "number")}
            {field("priceInr", "Price (₹)", "number")}
            {field("sortOrder", "Sort Order", "number")}
            <div className={styles.formGroup}>
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
          <div className={styles.formActions}>
            <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : formValues.id ? "Update Package" : "Create Package"}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className={styles.emptyState}>Loading packages…</p>
      ) : packages.length === 0 ? (
        <p className={styles.emptyState}>No packages yet. Create one above or seed the defaults.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Image</th>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Description</th>
                <th className={styles.th}>Credits</th>
                <th className={styles.th}>Price (₹)</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Order</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className={styles.tr}>
                  <td className={styles.td}>
                    {pkg.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pkg.imageUrl}
                        alt={pkg.name}
                        style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "8px", border: "1px solid #c6dcea" }}
                      />
                    ) : (
                      <span style={{ color: "#aaa", fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                  <td className={styles.td}><strong>{pkg.name}</strong></td>
                  <td className={styles.td}>{pkg.description || "—"}</td>
                  <td className={styles.td}>{pkg.credits}</td>
                  <td className={styles.td}>₹{pkg.priceInr.toLocaleString("en-IN")}</td>
                  <td className={styles.td}>
                    <span className={pkg.status === "active" ? styles.badgeActive : styles.badgeInactive}>
                      {pkg.status}
                    </span>
                  </td>
                  <td className={styles.td}>{pkg.sortOrder}</td>
                  <td className={styles.td}>
                    <button type="button" className={styles.linkButton} onClick={() => openEdit(pkg)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
