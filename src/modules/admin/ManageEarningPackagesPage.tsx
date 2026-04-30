"use client";

import { useState } from "react";
import styles from "./ManageEarningPackagesPage.module.css";
import CreditPackagesSection from "./CreditPackagesSection";
import PromotionPackagesSection from "./PromotionPackagesSection";

interface ManageEarningPackagesPageProps {
  operatorId: string;
}

const TAB_LIST = [
  { key: "credit", label: "Credit Packages" },
  { key: "promotion", label: "Promotion Packages" },
];


export default function ManageEarningPackagesPage({ operatorId }: ManageEarningPackagesPageProps) {
  const [activeTab, setActiveTab] = useState("credit");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.heroCard}>
          <h1 className={styles.title}>Manage Earning Packages</h1>
          <p className={styles.contextText}>
            Create, edit, and manage credit and promotion earning packages for all tenants. Use the tabs below to switch between package types.
          </p>
          <div className={styles.tabs}>
            {TAB_LIST.map((tab) => (
              <button
                key={tab.key}
                className={activeTab === tab.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                onClick={() => setActiveTab(tab.key)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>
        <section className={styles.contentCard}>
          {activeTab === "credit" ? (
            <CreditPackagesSection operatorId={operatorId} />
          ) : (
            <PromotionPackagesSection operatorId={operatorId} onOpenPromotionRequests={() => {}} />
          )}
        </section>
      </div>
    </main>
  );
}
