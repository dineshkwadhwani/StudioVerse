"use client";

import { useState } from "react";
import GuestLogPage from "./GuestLogPage";
import NotificationLogPage from "./NotificationLogPage";
import AuditLogPage from "./AuditLogPage";
import styles from "./LogsPage.module.css";

type LogsPageTenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
};

type LogsPageProps = {
  tenants: LogsPageTenantOption[];
};

type LogsTab = "guest-log" | "notification-log" | "audit-log";

const TAB_LIST: Array<{ key: LogsTab; label: string }> = [
  { key: "guest-log", label: "Guest Log" },
  { key: "notification-log", label: "Notification Log" },
  { key: "audit-log", label: "Audit Log" },
];

export default function LogsPage({ tenants }: LogsPageProps) {
  const [activeTab, setActiveTab] = useState<LogsTab>("guest-log");

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Logs</h2>
        <p className={styles.contextText}>
          Review platform delivery and interaction logs. Use tabs to switch between Guest Log and Notification Log views.
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
        {activeTab === "guest-log" ? <GuestLogPage tenants={tenants} /> : null}
        {activeTab === "notification-log" ? <NotificationLogPage tenants={tenants} /> : null}
        {activeTab === "audit-log" ? <AuditLogPage tenants={tenants} /> : null}
      </section>
    </section>
  );
}
