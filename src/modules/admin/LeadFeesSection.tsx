"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import styles from "./SuperAdminPortal.module.css";

type Props = {
  operatorId: string;
};

type TenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
};

type LeadConfigRecord = {
  enableCompanyLead?: boolean;
  enableCoachLead?: boolean;
  enableIndividualLead?: boolean;
  companyLeadFee?: number;
  coachLeadFee?: number;
  individualLeadFee?: number;
};

type LeadFeeFormValues = {
  enableCompanyLead: boolean;
  enableCoachLead: boolean;
  enableIndividualLead: boolean;
  companyLeadFee: number;
  coachLeadFee: number;
  individualLeadFee: number;
};

const EMPTY_FORM: LeadFeeFormValues = {
  enableCompanyLead: false,
  enableCoachLead: false,
  enableIndividualLead: false,
  companyLeadFee: 0,
  coachLeadFee: 0,
  individualLeadFee: 0,
};

function toSafeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toLeadFeeState(config: LeadConfigRecord | undefined): LeadFeeFormValues {
  return {
    enableCompanyLead: Boolean(config?.enableCompanyLead),
    enableCoachLead: Boolean(config?.enableCoachLead),
    enableIndividualLead: Boolean(config?.enableIndividualLead),
    companyLeadFee: Math.max(0, Math.floor(toSafeNumber(config?.companyLeadFee))),
    coachLeadFee: Math.max(0, Math.floor(toSafeNumber(config?.coachLeadFee))),
    individualLeadFee: Math.max(0, Math.floor(toSafeNumber(config?.individualLeadFee))),
  };
}

export default function LeadFeesSection({ operatorId }: Props) {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantDocId, setSelectedTenantDocId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [formValues, setFormValues] = useState<LeadFeeFormValues>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTenants(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const tenantQuery = query(collection(db, "tenants"), where("status", "==", "active"));
      const snapshot = await getDocs(tenantQuery);

      const rows: TenantOption[] = snapshot.docs
        .map((entry) => ({
          id: entry.id,
          tenantId: String(entry.data().tenantId ?? entry.id),
          tenantName: String(entry.data().tenantName ?? entry.data().tenantId ?? entry.id),
        }))
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName));

      setTenants(rows);
      if (rows.length === 0) {
        setSelectedTenantDocId("");
        setSelectedTenantId("");
        setFormValues(EMPTY_FORM);
        return;
      }

      const defaultTenant = rows[0];
      setSelectedTenantDocId(defaultTenant.id);
      setSelectedTenantId(defaultTenant.tenantId);
      const defaultSnap = snapshot.docs.find((entry) => entry.id === defaultTenant.id);
      const leadConfig = defaultSnap?.data().leadConfig as LeadConfigRecord | undefined;
      setFormValues(toLeadFeeState(leadConfig));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tenants.");
      setTenants([]);
      setSelectedTenantDocId("");
      setSelectedTenantId("");
      setFormValues(EMPTY_FORM);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantDocId),
    [tenants, selectedTenantDocId],
  );

  async function handleTenantChange(docId: string): Promise<void> {
    setSelectedTenantDocId(docId);
    setMessage("");
    setError("");

    if (!docId) {
      setSelectedTenantId("");
      setFormValues(EMPTY_FORM);
      return;
    }

    try {
      const target = tenants.find((tenant) => tenant.id === docId);
      setSelectedTenantId(target?.tenantId ?? "");

      const targetSnap = await getDoc(doc(db, "tenants", docId));
      const leadConfig = (targetSnap.data()?.leadConfig ?? undefined) as LeadConfigRecord | undefined;
      setFormValues(toLeadFeeState(leadConfig));
    } catch (tenantError) {
      setError(tenantError instanceof Error ? tenantError.message : "Failed to load selected tenant.");
      setFormValues(EMPTY_FORM);
    }
  }

  async function handleSave(): Promise<void> {
    if (!selectedTenantDocId || !selectedTenantId) {
      setError("Select a tenant first.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "tenants", selectedTenantDocId), {
        leadConfig: {
          enableCompanyLead: formValues.enableCompanyLead,
          enableCoachLead: formValues.enableCoachLead,
          enableIndividualLead: formValues.enableIndividualLead,
          companyLeadFee: formValues.enableCompanyLead ? Math.max(0, Math.floor(formValues.companyLeadFee)) : 0,
          coachLeadFee: formValues.enableCoachLead ? Math.max(0, Math.floor(formValues.coachLeadFee)) : 0,
          individualLeadFee: formValues.enableIndividualLead ? Math.max(0, Math.floor(formValues.individualLeadFee)) : 0,
        },
        updatedAt: serverTimestamp(),
        updatedBy: operatorId,
      });

      setMessage("Lead fee configuration saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save lead fee configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Manage Lead Fees</h2>
      <p className={styles.subtitle}>
        Configure lead visibility fees by tenant. A fee of 0 means the corresponding lead type remains fully visible.
      </p>

      {loading ? (
        <div className={styles.emptyCard}>Loading lead configuration...</div>
      ) : tenants.length === 0 ? (
        <div className={styles.emptyCard}>No active tenants found.</div>
      ) : (
        <>
          <div className={styles.tenantConfigBlock}>
            <p className={styles.tenantSubLabel}>Tenant</p>
            <select
              className={styles.select}
              value={selectedTenantDocId}
              onChange={(event) => void handleTenantChange(event.target.value)}
              disabled={saving}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.tenantName}
                </option>
              ))}
            </select>
            <p className={styles.subtitle} style={{ marginTop: 8 }}>
              Tenant ID: {selectedTenant?.tenantId ?? selectedTenantId}
            </p>
          </div>

          <div className={styles.tenantConfigBlock}>
            <p className={styles.tenantSubLabel}>Leads</p>
            <div className={styles.radioRow}>
              <label className={styles.radioPill}>
                <input
                  type="checkbox"
                  checked={formValues.enableCompanyLead}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      enableCompanyLead: event.target.checked,
                      companyLeadFee: event.target.checked ? prev.companyLeadFee : 0,
                    }))
                  }
                  disabled={saving}
                />
                Enable Company Lead
              </label>
              <label className={styles.radioPill}>
                <input
                  type="checkbox"
                  checked={formValues.enableCoachLead}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      enableCoachLead: event.target.checked,
                      coachLeadFee: event.target.checked ? prev.coachLeadFee : 0,
                    }))
                  }
                  disabled={saving}
                />
                Enable Coach Lead
              </label>
              <label className={styles.radioPill}>
                <input
                  type="checkbox"
                  checked={formValues.enableIndividualLead}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      enableIndividualLead: event.target.checked,
                      individualLeadFee: event.target.checked ? prev.individualLeadFee : 0,
                    }))
                  }
                  disabled={saving}
                />
                Enable Individual Lead
              </label>
            </div>
          </div>

          <div className={styles.tenantConfigBlock}>
            <p className={styles.tenantSubLabel}>Lead Fees</p>
            {!formValues.enableCompanyLead && !formValues.enableCoachLead && !formValues.enableIndividualLead ? (
              <p className={styles.subtitle}>Enable at least one lead type in tenant configuration to set fees.</p>
            ) : (
              <div className={styles.tenantConfigGrid}>
                {formValues.enableCompanyLead ? (
                  <div className={styles.compactField}>
                    <label className={styles.compactLabel} htmlFor="company-lead-fee">
                      Company Lead Fee
                    </label>
                    <input
                      id="company-lead-fee"
                      type="number"
                      min={0}
                      className={`${styles.input} ${styles.compactInput}`}
                      value={formValues.companyLeadFee}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          companyLeadFee: Math.max(0, Math.floor(toSafeNumber(event.target.value))),
                        }))
                      }
                      disabled={saving}
                    />
                  </div>
                ) : null}

                {formValues.enableCoachLead ? (
                  <div className={styles.compactField}>
                    <label className={styles.compactLabel} htmlFor="coach-lead-fee">
                      Coach Lead Fee
                    </label>
                    <input
                      id="coach-lead-fee"
                      type="number"
                      min={0}
                      className={`${styles.input} ${styles.compactInput}`}
                      value={formValues.coachLeadFee}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          coachLeadFee: Math.max(0, Math.floor(toSafeNumber(event.target.value))),
                        }))
                      }
                      disabled={saving}
                    />
                  </div>
                ) : null}

                {formValues.enableIndividualLead ? (
                  <div className={styles.compactField}>
                    <label className={styles.compactLabel} htmlFor="individual-lead-fee">
                      Individual Lead Fee
                    </label>
                    <input
                      id="individual-lead-fee"
                      type="number"
                      min={0}
                      className={`${styles.input} ${styles.compactInput}`}
                      value={formValues.individualLeadFee}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          individualLeadFee: Math.max(0, Math.floor(toSafeNumber(event.target.value))),
                        }))
                      }
                      disabled={saving}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.info}>{message}</p> : null}

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save Lead Fees"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
