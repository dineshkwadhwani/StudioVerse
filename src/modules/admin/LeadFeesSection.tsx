"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/services/firebase";
import styles from "./SuperAdminPortal.module.css";
import type { LeadPackageRecord } from "@/types/earningPackages";

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

function toLeadFeeStateFromPackages(packages: LeadPackageRecord[] | undefined): LeadFeeFormValues {
  const byUserType = new Map((packages ?? []).map((pkg) => [pkg.userType, pkg]));
  return {
    enableCompanyLead: Boolean(byUserType.get("company")?.enabled),
    enableCoachLead: Boolean(byUserType.get("professional")?.enabled),
    enableIndividualLead: Boolean(byUserType.get("individual")?.enabled),
    companyLeadFee: Math.max(0, Math.floor(toSafeNumber(byUserType.get("company")?.leadFee))),
    coachLeadFee: Math.max(0, Math.floor(toSafeNumber(byUserType.get("professional")?.leadFee))),
    individualLeadFee: Math.max(0, Math.floor(toSafeNumber(byUserType.get("individual")?.leadFee))),
  };
}

function hasLeadConfig(data: Record<string, unknown> | undefined): boolean {
  return Boolean(data && Object.prototype.hasOwnProperty.call(data, "leadConfig"));
}

async function loadLeadStateForTenant(docId: string): Promise<LeadFeeFormValues> {
  if (!docId) {
    return EMPTY_FORM;
  }

  const tenantSnap = await getDoc(doc(db, "tenants", docId));
  const tenantData = tenantSnap.data() as Record<string, unknown> | undefined;
  if (hasLeadConfig(tenantData)) {
    return toLeadFeeState(tenantData?.leadConfig as LeadConfigRecord | undefined);
  }

  const earningSnap = await getDoc(doc(db, "earningPackages", docId));
  const earningData = earningSnap.data() as Record<string, unknown> | undefined;
  const leadPackages = Array.isArray(earningData?.leadPackages)
    ? (earningData?.leadPackages as LeadPackageRecord[])
    : [];
  return toLeadFeeStateFromPackages(leadPackages);
}

function buildLeadPackages(tenantId: string, values: LeadFeeFormValues, operatorId: string, existingPackages: LeadPackageRecord[] = []): LeadPackageRecord[] {
  const now = Timestamp.now();
  const existingByType = new Map(existingPackages.map((pkg) => [pkg.userType, pkg]));

  return [
    {
      ...(existingByType.get("company") ?? {}),
      id: existingByType.get("company")?.id ?? `${tenantId}-company-lead`,
      name: "Company Lead",
      userType: "company",
      enabled: values.enableCompanyLead,
      leadFee: values.enableCompanyLead ? Math.max(0, Math.floor(values.companyLeadFee)) : 0,
      description: existingByType.get("company")?.description ?? "Company lead unlock",
      createdBy: existingByType.get("company")?.createdBy ?? operatorId,
      updatedBy: operatorId,
      createdAt: existingByType.get("company")?.createdAt ?? now,
      updatedAt: now,
    },
    {
      ...(existingByType.get("professional") ?? {}),
      id: existingByType.get("professional")?.id ?? `${tenantId}-professional-lead`,
      name: "Coach Lead",
      userType: "professional",
      enabled: values.enableCoachLead,
      leadFee: values.enableCoachLead ? Math.max(0, Math.floor(values.coachLeadFee)) : 0,
      description: existingByType.get("professional")?.description ?? "Coach lead unlock",
      createdBy: existingByType.get("professional")?.createdBy ?? operatorId,
      updatedBy: operatorId,
      createdAt: existingByType.get("professional")?.createdAt ?? now,
      updatedAt: now,
    },
    {
      ...(existingByType.get("individual") ?? {}),
      id: existingByType.get("individual")?.id ?? `${tenantId}-individual-lead`,
      name: "Individual Lead",
      userType: "individual",
      enabled: values.enableIndividualLead,
      leadFee: values.enableIndividualLead ? Math.max(0, Math.floor(values.individualLeadFee)) : 0,
      description: existingByType.get("individual")?.description ?? "Individual lead unlock",
      createdBy: existingByType.get("individual")?.createdBy ?? operatorId,
      updatedBy: operatorId,
      createdAt: existingByType.get("individual")?.createdAt ?? now,
      updatedAt: now,
    },
  ];
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
      setFormValues(await loadLeadStateForTenant(defaultTenant.id));
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
      setFormValues(await loadLeadStateForTenant(docId));
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
      const earningRef = doc(db, "earningPackages", selectedTenantId);
      const earningSnap = await getDoc(earningRef);
      const existingLeadPackages = Array.isArray(earningSnap.data()?.leadPackages)
        ? (earningSnap.data()?.leadPackages as LeadPackageRecord[])
        : [];

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

      await setDoc(
        earningRef,
        {
          tenantId: selectedTenantId,
          leadPackages: buildLeadPackages(selectedTenantId, formValues, operatorId, existingLeadPackages),
          updatedAt: serverTimestamp(),
          ...(earningSnap.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

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
