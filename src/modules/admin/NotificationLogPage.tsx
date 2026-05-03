"use client";

import { useMemo, useState } from "react";
import {
  NOTIFICATION_CATEGORY_DEFINITIONS,
  type NotificationCategory,
} from "@/constants/notifications";
import {
  listNotificationLogs,
  type NotificationLogListRecord,
} from "@/services/notification-log.service";
import styles from "./NotificationLogPage.module.css";

type ActivityFilter = "all" | NotificationCategory;

type NotificationLogTenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
};

type NotificationLogPageProps = {
  tenants: NotificationLogTenantOption[];
};

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return value.toLocaleString();
}

function formatNotificationType(type: string): string {
  const matched = NOTIFICATION_CATEGORY_DEFINITIONS.find((item) => item.key === type);
  return matched?.label ?? type;
}

export default function NotificationLogPage({ tenants }: NotificationLogPageProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [tenantId, setTenantId] = useState<string>("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [logs, setLogs] = useState<NotificationLogListRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const sortedActivityOptions = useMemo(
    () => [...NOTIFICATION_CATEGORY_DEFINITIONS].sort((left, right) => left.label.localeCompare(right.label)),
    []
  );

  async function searchLogs(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const records = await listNotificationLogs({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        notificationType: activity,
        tenantId,
        recipientEmailSearch: emailSearch,
      });
      setLogs(records);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notification logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Notification Log</h2>
        <p className={styles.contextText}>
          Review sent, blocked, and failed notification deliveries. Filter by date range and activity type, then search to load matching logs.
        </p>

        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Tenant</span>
            <select
              className={styles.filterSelect}
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            >
              <option value="all">All</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.tenantId}>
                  {tenant.tenantName}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>From Date</span>
            <input
              type="date"
              className={styles.filterInput}
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>To Date</span>
            <input
              type="date"
              className={styles.filterInput}
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Activity</span>
            <select
              className={styles.filterSelect}
              value={activity}
              onChange={(event) => setActivity(event.target.value as ActivityFilter)}
            >
              <option value="all">All</option>
              {sortedActivityOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Email</span>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Search recipient email"
              value={emailSearch}
              onChange={(event) => setEmailSearch(event.target.value)}
            />
          </label>

          <div className={styles.searchActions}>
            <button type="button" className={styles.searchButton} onClick={() => void searchLogs()} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.contentCard}>
        <h3 className={styles.contentHeading}>Notification Results</h3>
        {!hasSearched && <p className={styles.infoText}>Apply filters and click Search Notifications to load delivery logs.</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {hasSearched && !error && logs.length === 0 && (
          <p className={styles.infoText}>No notification logs found for the selected filters.</p>
        )}

        {hasSearched && logs.length > 0 && (
          <div className={styles.logsList}>
            {logs.map((log) => (
              <article key={log.id} className={styles.logCard}>
                <div className={styles.logMeta}>
                  <div>
                    Sent At: <span className={styles.metaValue}>{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div>
                    Activity: <span className={styles.metaValue}>{formatNotificationType(log.notificationType)}</span>
                  </div>
                  <div>
                    Status: <span className={styles.metaValue}>{log.status}</span>
                  </div>
                  <div>
                    Tenant: <span className={styles.metaValue}>{log.tenantId || "-"}</span>
                  </div>
                  <div>
                    Recipient: <span className={styles.metaValue}>{log.recipientName || "-"}</span>
                  </div>
                  <div>
                    Email: <span className={styles.metaValue}>{log.recipientEmail || "-"}</span>
                  </div>
                  <div className={styles.fullRow}>
                    Reason: <span className={styles.metaValue}>{log.reason || "-"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
