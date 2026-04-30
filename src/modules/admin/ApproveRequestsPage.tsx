"use client";

import { useState } from "react";
import styles from "./ManageEarningPackagesPage.module.css";
import PromotionRequestsSection from "./PromotionRequestsSection";
import CashoutRequestsSection from "./CashoutRequestsSection";
import ListingRequestsSection from "./ListingRequestsSection";
import BotHeroRequestsSection from "./BotHeroRequestsSection";

interface ApproveRequestsPageProps {
  operatorId: string;
}

const TAB_LIST = [
  { key: "promotion", label: "Promotion" },
  { key: "cashout", label: "Cash Out" },
  { key: "listing", label: "Listing" },
  { key: "bot-hero", label: "Bot Hero" },
];

export default function ApproveRequestsPage({ operatorId }: ApproveRequestsPageProps) {
  const [activeTab, setActiveTab] = useState("promotion");

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Approve Requests</h2>
        <p className={styles.contextText}>
          Review and approve pending requests across promotions, cashouts, listings, and bot hero submissions.
        </p>
        <div className={styles.tabBar}>
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
        {activeTab === "promotion" && (
          <PromotionRequestsSection operatorId={operatorId} />
        )}
        {activeTab === "cashout" && <CashoutRequestsSection />}
        {activeTab === "listing" && <ListingRequestsSection />}
        {activeTab === "bot-hero" && <BotHeroRequestsSection />}
      </section>
    </section>
  );
}
