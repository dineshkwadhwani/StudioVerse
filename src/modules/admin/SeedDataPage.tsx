"use client";


import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import styles from "./SuperAdminPortal.module.css";
import { db } from "@/services/firebase";
import { listCategoriesFlattened, seedTaxonomyFromXlsx } from "@/services/categories.service";
import { seedLanguages, listLanguages } from "@/services/languages.service";
import { seedEarningPackages, getEarningPackages } from "@/services/earningPackages.service";
import { SEED_SCRIPTS, SeedScriptConfig } from "@/config/seeds.config";

type TenantOption = {
  id: string;
  name: string;
};

type Props = {
  operatorId: string;
};

type SeedState = {
  checking: boolean;
  busy: boolean;
  seeded: boolean;
  message: string;
  error: string;
};

const INITIAL: SeedState = {
  checking: true,
  busy: false,
  seeded: false,
  message: "Checking existing data...",
  error: "",
};

const DEFAULT_LANGUAGE_COUNT = 30;
const DEFAULT_TENANT_ID = "all";

export default function SeedDataPage({ operatorId }: Props) {
  const [tenantId, setTenantId] = useState<string>(DEFAULT_TENANT_ID);
  const [seedStates, setSeedStates] = useState<Record<string, SeedState>>({});
  const [availableTenants, setAvailableTenants] = useState<TenantOption[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    void fetchAvailableTenants();
  }, []);

  useEffect(() => {
    void hydrateSeedStatus(tenantId);
  }, [tenantId]);

  async function fetchAvailableTenants() {
    try {
      const q = query(collection(db, "tenants"), where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const tenants: TenantOption[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: (doc.data() as Record<string, unknown>).tenantName as string || doc.id,
      }));
      setAvailableTenants(tenants);
    } catch (err) {
      console.error("Failed to fetch tenants:", err);
    } finally {
      setLoadingTenants(false);
    }
  }


  async function hydrateSeedStatus(selectedTenant: string) {
    const newStates: Record<string, SeedState> = {};
    await Promise.all(SEED_SCRIPTS.map(async (script) => {
      newStates[script.id] = { ...INITIAL };
      try {
        if (script.id === "languages") {
          const languageRows = await listLanguages();
          const seeded = languageRows.length >= 30;
          newStates[script.id] = {
            checking: false,
            busy: false,
            seeded,
            message: seeded
              ? `Already seeded. Found ${languageRows.length} languages.`
              : `Not seeded yet. Found ${languageRows.length} language records.`,
            error: "",
          };
        } else if (script.id === "taxonomy") {
          const taxonomyData = await listCategoriesFlattened();
          const { categories, subCategories, topics } = taxonomyData;
          const seeded = categories.length > 0 && subCategories.length > 0 && topics.length > 0;
          newStates[script.id] = {
            checking: false,
            busy: false,
            seeded,
            message: seeded
              ? "Already seeded. Taxonomy data exists in this environment."
              : "Not seeded yet.",
            error: "",
          };
        } else if (script.id === "earningPackages") {
          const earningData = await getEarningPackages(selectedTenant).catch(() => null);
          const seeded = (earningData && earningData.creditPackages && earningData.creditPackages.length > 0) ?? false;
          const creditCount = earningData?.creditPackages?.length ?? 0;
          newStates[script.id] = {
            checking: false,
            busy: false,
            seeded,
            message: seeded
              ? `Already seeded. Found ${creditCount} credit packages in earning packages doc.`
              : "Not seeded yet.",
            error: "",
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to check seed status.";
        newStates[script.id] = { checking: false, busy: false, seeded: false, message: "", error: message };
      }
    }));
    setSeedStates(newStates);
  }


  async function handleSeed(script: SeedScriptConfig) {
    const current = seedStates[script.id];
    if (current?.seeded || current?.checking) return;
    
    // Prevent seeding when "All Tenants" is selected
    if (tenantId === "all") {
      setSeedStates((prev) => ({
        ...prev,
        [script.id]: {
          ...prev[script.id],
          error: "Please select a specific tenant to seed data.",
        },
      }));
      return;
    }
    
    setSeedStates((prev) => ({ ...prev, [script.id]: { ...prev[script.id], busy: true } }));
    try {
      let result: any;
      if (script.id === "languages") {
        result = await seedLanguages(tenantId);
        setSeedStates((prev) => ({
          ...prev,
          [script.id]: {
            checking: false,
            busy: false,
            seeded: true,
            message: result.added > 0
              ? `Languages seeded. Added ${result.added} languages (${result.skipped} already existed).`
              : `All ${result.skipped} languages already exist — nothing to add.`,
            error: "",
          },
        }));
      } else if (script.id === "taxonomy") {
        result = await seedTaxonomyFromXlsx(tenantId);
        const totalAdded = result.categories + result.subCategories + result.topics;
        setSeedStates((prev) => ({
          ...prev,
          [script.id]: {
            checking: false,
            busy: false,
            seeded: true,
            message: totalAdded > 0
              ? `Taxonomy seeded. Added ${result.categories} categories, ${result.subCategories} sub-categories, and ${result.topics} topics.`
              : "Already seeded. No new taxonomy records were added.",
            error: "",
          },
        }));
      } else if (script.id === "earningPackages") {
        result = await seedEarningPackages(tenantId);
        setSeedStates((prev) => ({
          ...prev,
          [script.id]: {
            checking: false,
            busy: false,
            seeded: true,
            message: result.status === "already-exists"
              ? `Already seeded. Found ${result.creditPackages} credit packages, ${result.listingPackages} listing packages, ${result.botPackages} bot packages.`
              : `Earning packages seeded. Added ${result.creditPackages} credit packages, ${result.listingPackages} listing packages, ${result.botPackages} bot packages.`,
            error: "",
          },
        }));
      }
    } catch (err) {
      setSeedStates((prev) => ({
        ...prev,
        [script.id]: {
          ...prev[script.id],
          busy: false,
          error: err instanceof Error ? err.message : "Seeding failed.",
        },
      }));
    }
  }


  // Filter scripts for selected tenant ("all" shows all scripts)
  const availableScripts = tenantId === "all"
    ? SEED_SCRIPTS
    : SEED_SCRIPTS.filter((s) => s.tenants.includes(tenantId));

  // Map tenant IDs to names for display
  const tenantNameById = new Map(availableTenants.map((t) => [t.id, t.name]));

  return (
    <div className={styles.sectionWrap}>
      {/* Hero Card */}
      <div className={styles.contentBox} style={{ marginBottom: 32 }}>
        <h1 className={styles.title}>Seed Data</h1>
        <p className={styles.subtitle}>
          Populate reference data for a new environment. All seed operations are idempotent and safe to re-run. Select a tenant to view and run available seed scripts.
        </p>
        <div style={{ marginTop: 18, maxWidth: 320 }}>
          <label className={styles.label} htmlFor="tenant-select">Tenant</label>
          <select
            id="tenant-select"
            className={styles.select}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            disabled={loadingTenants}
          >
            <option value="all">All Tenants</option>
            {availableTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24, marginTop: 8 }}>
        {availableScripts.map((script) => {
          const state = seedStates[script.id] || INITIAL;
          return (
            <div
              key={script.id}
              className={styles.card}
              style={{ minHeight: 220, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <h3 style={{ margin: 0, fontSize: "1.08rem", fontWeight: 700, color: "#1b4159" }}>{script.displayName}</h3>
              <p style={{ margin: 0, fontSize: "0.92rem", color: "#4d6e86", lineHeight: 1.5 }}>{script.description}</p>
              {tenantId === "all" && (
                <div style={{ fontSize: "0.85rem", color: "#1a6189", margin: "4px 0 0" }}>
                  <b>Available for:</b> {script.tenants.map(tid => tenantNameById.get(tid) || tid).join(", ")}
                </div>
              )}
              {state.message ? (
                <p className={styles.successMsg} style={{ margin: 0 }}>{state.message}</p>
              ) : null}
              {state.error ? (
                <p className={styles.errorMsg} style={{ margin: 0 }}>{state.error}</p>
              ) : null}
              {tenantId === "all" && (
                <p style={{ fontSize: "0.85rem", color: "#e74c3c", margin: 0 }}>Select a tenant to seed</p>
              )}
              <button
                type="button"
                className={state.seeded ? styles.ghostButton : styles.button}
                onClick={() => handleSeed(script)}
                disabled={state.busy || state.seeded || state.checking || tenantId === "all"}
                style={{ alignSelf: "flex-start", marginTop: "auto" }}
              >
                {state.checking
                  ? "Checking..."
                  : state.busy
                    ? "Seeding..."
                    : state.seeded
                      ? "Seeded"
                      : `Seed ${script.displayName}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
