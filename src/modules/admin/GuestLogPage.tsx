"use client";

import { useState } from "react";
import {
  listGuestLogs,
  type GuestLogCategory,
  type GuestLogRecord,
} from "@/services/guestLog.service";
import styles from "./GuestLogPage.module.css";

type CategoryFilter = "all" | GuestLogCategory;

function formatDate(value: Date | null): string {
  if (!value) {
    return "-";
  }

  return value.toLocaleString();
}

function formatCategory(value: GuestLogCategory): string {
  return value === "coaching-studio" ? "Coaching Studio" : "General";
}

export default function GuestLogPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [logs, setLogs] = useState<GuestLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function searchLogs(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const records = await listGuestLogs({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        category,
        phoneSearch,
      });

      setLogs(records);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load guest logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Guest Log</h2>
        <p className={styles.contextText}>
          Search and review guest bot conversations captured as leads by date range, category, and phone number.
        </p>

        <div className={styles.filterGrid}>
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
            <span className={styles.filterLabel}>Category</span>
            <select
              className={styles.filterSelect}
              value={category}
              onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            >
              <option value="all">All</option>
              <option value="coaching-studio">Coaching Studio</option>
              <option value="general">General</option>
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Phone Number</span>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Search phone"
              value={phoneSearch}
              onChange={(event) => setPhoneSearch(event.target.value)}
            />
          </label>

          <div className={styles.searchActions}>
            <button type="button" className={styles.searchButton} onClick={() => void searchLogs()} disabled={loading}>
              {loading ? "Searching..." : "Search Logs"}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.contentCard}>
        <h3 className={styles.contentHeading}>Guest Conversation Logs</h3>
        {!hasSearched && <p className={styles.infoText}>Apply filters and click Search Logs to load guest conversations.</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {hasSearched && !error && logs.length === 0 && (
          <p className={styles.infoText}>No guest logs found for the selected filters.</p>
        )}

        {hasSearched && logs.length > 0 && (
          <div className={styles.logsList}>
            {logs.map((log) => (
              <article key={log.id} className={styles.logCard}>
                <div className={styles.logMeta}>
                  <div>
                    Bot: <span className={styles.metaValue}>{log.botName}</span>
                  </div>
                  <div>
                    Guest: <span className={styles.metaValue}>{log.guestName}</span>
                  </div>
                  <div>
                    Number: <span className={styles.metaValue}>{log.guestPhone}</span>
                  </div>
                  <div>
                    Last Category: <span className={styles.metaValue}>{formatCategory(log.category)}</span>
                  </div>
                  <div>
                    Last Date: <span className={styles.metaValue}>{formatDate(log.lastConversationAt)}</span>
                  </div>
                  <div>
                    Messages: <span className={styles.metaValue}>{log.conversationCount}</span>
                  </div>
                </div>

                <div className={styles.conversation}>
                  {log.conversation.map((entry, index) => (
                    <div key={`${log.id}-${index}`} className={styles.entry}>
                      <div className={styles.entryMeta}>
                        <span>{formatCategory(entry.category)}</span>
                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}</span>
                      </div>
                      <p className={styles.question}><strong>Guest:</strong> {entry.question}</p>
                      <p className={styles.answer}><strong>Bot:</strong> {entry.answer}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
