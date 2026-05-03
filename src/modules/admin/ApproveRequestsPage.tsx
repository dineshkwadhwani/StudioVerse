"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import styles from "./ManageEarningPackagesPage.module.css";
import { db } from "@/services/firebase";
import { listPromotionRequests } from "@/services/programPromotionRequests.service";
import { listPendingBotHeroRequests } from "@/services/botHero.service";
import { listListingRequests } from "@/services/listingRequests.service";
import PromotionRequestsSection from "./PromotionRequestsSection";
import CashoutRequestsSection from "./CashoutRequestsSection";
import ListingRequestsSection from "./ListingRequestsSection";
import BotHeroRequestsSection from "./BotHeroRequestsSection";

interface ApproveRequestsPageProps {
  operatorId: string;
  initialTab?: TabKey;
}

type TabKey = "promotion" | "cashout" | "listing" | "bot-hero";

type PendingCounts = {
  promotion: number;
  cashout: number;
  listing: number;
  botHero: number;
};

const TAB_LIST = [
  { key: "promotion", label: "Promotion", countKey: "promotion" },
  { key: "cashout", label: "Cash Out", countKey: "cashout" },
  { key: "listing", label: "Listing", countKey: "listing" },
  { key: "bot-hero", label: "Bot Hero", countKey: "botHero" },
] as const;

const EMPTY_COUNTS: PendingCounts = {
  promotion: 0,
  cashout: 0,
  listing: 0,
  botHero: 0,
};

export default function ApproveRequestsPage({ operatorId, initialTab }: ApproveRequestsPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? "promotion");
  const [counts, setCounts] = useState<PendingCounts>(EMPTY_COUNTS);

  async function refreshPendingCounts() {
    const [pendingCashoutSnap, pendingPromotionRows, pendingBotHeroRows, pendingListingRows] = await Promise.all([
      getDocs(query(collection(db, "cashoutRequests"), where("status", "==", "pending"))),
      listPromotionRequests(),
      listPendingBotHeroRequests(),
      listListingRequests(),
    ]);

    setCounts({
      promotion: pendingPromotionRows.length,
      cashout: pendingCashoutSnap.size,
      listing: pendingListingRows.length,
      botHero: pendingBotHeroRows.length,
    });
  }

  useEffect(() => {
    void refreshPendingCounts();
  }, []);

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
              <span className={styles.tabLabel}>{tab.label}</span>
              <span className={styles.tabBadge}>{counts[tab.countKey]}</span>
            </button>
          ))}
        </div>
      </section>
      <section className={styles.contentCard}>
        {activeTab === "promotion" && (
          <PromotionRequestsSection operatorId={operatorId} onRequestsChanged={refreshPendingCounts} />
        )}
        {activeTab === "cashout" && <CashoutRequestsSection operatorId={operatorId} onRequestsChanged={refreshPendingCounts} />}
        {activeTab === "listing" && <ListingRequestsSection operatorId={operatorId} onRequestsChanged={refreshPendingCounts} />}
        {activeTab === "bot-hero" && <BotHeroRequestsSection operatorId={operatorId} onRequestsChanged={refreshPendingCounts} />}
      </section>
    </section>
  );
}
