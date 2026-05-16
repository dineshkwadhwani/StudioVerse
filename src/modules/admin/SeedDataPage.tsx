"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import { listCategoriesFlattened, seedTaxonomyFromXlsx } from "@/services/categories.service";
import { seedLanguages, listLanguages } from "@/services/languages.service";
import { seedEarningPackages, getEarningPackages } from "@/services/earningPackages.service";

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
const TENANT_ID = "coaching-studio";

export default function SeedDataPage({ operatorId }: Props) {
  const [taxonomy, setTaxonomy] = useState<SeedState>(INITIAL);
  const [languages, setLanguages] = useState<SeedState>(INITIAL);
  const [creditPackages, setCreditPackages] = useState<SeedState>(INITIAL);

  useEffect(() => {
    void hydrateSeedStatus();
  }, []);

  async function hydrateSeedStatus() {
    try {
      const [taxonomyData, languageRows, earningData] = await Promise.all([
        listCategoriesFlattened(),
        listLanguages(),
        getEarningPackages(TENANT_ID).catch(() => null),
      ]);

      const { categories, subCategories, topics } = taxonomyData;
      const taxonomySeeded = categories.length > 0 && subCategories.length > 0 && topics.length > 0;
      const languageSeeded = languageRows.length >= 30;

      const packageSeeded = (earningData && earningData.creditPackages && earningData.creditPackages.length > 0) ?? false;
      const creditCount = earningData?.creditPackages?.length ?? 0;

      setTaxonomy({
        checking: false,
        busy: false,
        seeded: taxonomySeeded,
        message: taxonomySeeded
          ? "Already seeded. Taxonomy data exists in this environment."
          : "Not seeded yet.",
        error: "",
      });

      setLanguages({
        checking: false,
        busy: false,
        seeded: languageSeeded,
        message: languageSeeded
          ? `Already seeded. Found ${languageRows.length} languages.`
          : `Not seeded yet. Found ${languageRows.length} language records.`,
        error: "",
      });

      setCreditPackages({
        checking: false,
        busy: false,
        seeded: packageSeeded,
        message: packageSeeded
          ? `Already seeded. Found ${creditCount} credit packages in earning packages doc.`
          : "Not seeded yet.",
        error: "",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to check seed status.";
      setTaxonomy({ checking: false, busy: false, seeded: false, message: "", error: message });
      setLanguages({ checking: false, busy: false, seeded: false, message: "", error: message });
      setCreditPackages({ checking: false, busy: false, seeded: false, message: "", error: message });
    }
  }

  async function handleSeedTaxonomy() {
    if (taxonomy.seeded || taxonomy.checking) {
      return;
    }
    setTaxonomy({ checking: false, busy: true, seeded: false, message: "", error: "" });
    try {
      const result = await seedTaxonomyFromXlsx();
      const totalAdded = result.categories + result.subCategories + result.topics;
      setTaxonomy({
        checking: false,
        busy: false,
        seeded: true,
        message: totalAdded > 0
          ? `Taxonomy seeded. Added ${result.categories} categories, ${result.subCategories} sub-categories, and ${result.topics} topics.`
          : "Already seeded. No new taxonomy records were added.",
        error: "",
      });
    } catch (err) {
      setTaxonomy({ checking: false, busy: false, seeded: false, message: "", error: err instanceof Error ? err.message : "Seeding failed." });
    }
  }

  async function handleSeedLanguages() {
    if (languages.seeded || languages.checking) {
      return;
    }
    setLanguages({ checking: false, busy: true, seeded: false, message: "", error: "" });
    try {
      const result = await seedLanguages();
      setLanguages({
        checking: false,
        busy: false,
        seeded: true,
        message: result.added > 0
          ? `Languages seeded. Added ${result.added} languages (${result.skipped} already existed).`
          : `All ${result.skipped} languages already exist — nothing to add.`,
        error: "",
      });
    } catch (err) {
      setLanguages({ checking: false, busy: false, seeded: false, message: "", error: err instanceof Error ? err.message : "Seeding failed." });
    }
  }

  async function handleSeedCreditPackages() {
    if (creditPackages.seeded || creditPackages.checking) {
      return;
    }
    setCreditPackages({ checking: false, busy: true, seeded: false, message: "", error: "" });
    try {
      const result = await seedEarningPackages();
      setCreditPackages({
        checking: false,
        busy: false,
        seeded: true,
        message: result.status === "already-exists"
          ? `Already seeded. Found ${result.creditPackages} credit packages, ${result.listingPackages} listing packages, ${result.botPackages} bot packages.`
          : `Earning packages seeded. Added ${result.creditPackages} credit packages, ${result.listingPackages} listing packages, ${result.botPackages} bot packages.`,
        error: "",
      });
    } catch (err) {
      setCreditPackages({ checking: false, busy: false, seeded: false, message: "", error: err instanceof Error ? err.message : "Seeding failed." });
    }
  }

  const seeds: Array<{
    key: string;
    title: string;
    description: string;
    buttonLabel: string;
    busyLabel: string;
    seededLabel: string;
    state: SeedState;
    onSeed: () => void;
  }> = [
    {
      key: "taxonomy",
      title: "Taxonomy",
      description: "Seeds Categories, Sub-Categories, and Topics from the master taxonomy Excel file. Idempotent — safely re-run at any time.",
      buttonLabel: "Seed Taxonomy",
      busyLabel: "Seeding...",
      seededLabel: "Seeded",
      state: taxonomy,
      onSeed: () => { void handleSeedTaxonomy(); },
    },
    {
      key: "languages",
      title: "Languages",
      description: "Seeds the 30 major languages (including Indian regional languages) used in the Language dropdown on Programs, Events, and Assessments.",
      buttonLabel: "Seed Languages",
      busyLabel: "Seeding...",
      seededLabel: "Seeded",
      state: languages,
      onSeed: () => { void handleSeedLanguages(); },
    },
    {
      key: "credit-packages",
      title: "Earning Packages",
      description: "Seeds all earning-related packages (Credit Packages, Listing Packages, Bot Hero Packages) into a unified document per tenant. This consolidates all earning configuration in one place for efficiency. Idempotent — safely re-run at any time.",
      buttonLabel: "Seed Earning Packages",
      busyLabel: "Seeding...",
      seededLabel: "Seeded",
      state: creditPackages,
      onSeed: () => { void handleSeedCreditPackages(); },
    },
  ];

  return (
    <div className={styles.sectionWrap}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Seed Data</h2>
          <p className={styles.sectionSub}>
            Populate reference data for a new environment. All seed operations are idempotent — safe to re-run.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginTop: 24 }}>
        {seeds.map((seed) => (
          <div
            key={seed.key}
            style={{
              background: "#fff",
              border: "1px solid #d9e8f2",
              borderRadius: 10,
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1b4159" }}>{seed.title}</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#4d6e86", lineHeight: 1.5 }}>{seed.description}</p>

            {seed.state.message ? (
              <p className={styles.successMsg} style={{ margin: 0 }}>{seed.state.message}</p>
            ) : null}
            {seed.state.error ? (
              <p className={styles.errorMsg} style={{ margin: 0 }}>{seed.state.error}</p>
            ) : null}

            <button
              type="button"
              className={seed.state.seeded ? styles.ghostButton : styles.button}
              onClick={seed.onSeed}
              disabled={seed.state.busy || seed.state.seeded || seed.state.checking}
              style={{ alignSelf: "flex-start", marginTop: "auto" }}
            >
              {seed.state.checking
                ? "Checking..."
                : seed.state.busy
                  ? seed.busyLabel
                  : seed.state.seeded
                    ? seed.seededLabel
                    : seed.buttonLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
