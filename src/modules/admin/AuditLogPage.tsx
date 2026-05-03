"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_AUDIT_ACTION_TYPES,
  listAuditLogs,
  type AuditLogRecord,
} from "@/services/audit-log.service";
import styles from "./AuditLogPage.module.css";

type AuditLogTenantOption = {
  id: string;
  tenantId: string;
  tenantName: string;
};

type AuditLogPageProps = {
  tenants: AuditLogTenantOption[];
};

function formatDateTime(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return value.toLocaleString();
}

export default function AuditLogPage({ tenants }: AuditLogPageProps) {
  const [tenantId, setTenantId] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionType, setActionType] = useState<string>("all");
  const [performedBy, setPerformedBy] = useState("");
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const sortedActionTypes = useMemo(
    () => [...DEFAULT_AUDIT_ACTION_TYPES].sort((left, right) => left.localeCompare(right)),
    []
  );

  async function searchLogs(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const records = await listAuditLogs({
        tenantId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        actionType,
        actorSearch: performedBy,
      });
      setLogs(records);
      setHasSearched(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load audit logs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Audit Log</h2>
        <p className={styles.contextText}>
          Review immutable audit trail entries. Filter by tenant, date, action type, and actor before searching.
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
            <span className={styles.filterLabel}>Action Type</span>
            <select
              className={styles.filterSelect}
              value={actionType}
              onChange={(event) => setActionType(event.target.value)}
            >
              <option value="all">All</option>
              {sortedActionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Action Performed By</span>
            <input
              type="text"
              className={styles.filterInput}
              placeholder="Search actor"
              value={performedBy}
              onChange={(event) => setPerformedBy(event.target.value)}
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
        <h3 className={styles.contentHeading}>Audit Results</h3>
        {!hasSearched && <p className={styles.infoText}>Apply filters and click Search to load audit log entries.</p>}
        {error && <p className={styles.errorText}>{error}</p>}

        {hasSearched && !error && logs.length === 0 && (
          <p className={styles.infoText}>No audit logs found for the selected filters.</p>
        )}

        {hasSearched && logs.length > 0 && (
          <div className={styles.logsList}>
            {logs.map((log) => (
              <article key={log.id} className={styles.logCard}>
                <div className={styles.logMeta}>
                  <div>
                    Time: <span className={styles.metaValue}>{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div>
                    Tenant: <span className={styles.metaValue}>{log.tenantId || "-"}</span>
                  </div>
                  <div>
                    Action: <span className={styles.metaValue}>{log.actionType || "-"}</span>
                  </div>
                  <div>
                    Action Performed By: <span className={styles.metaValue}>{log.actorName || "-"}</span>
                  </div>
                  <div>
                    Actor ID: <span className={styles.metaValue}>{log.actorId || "-"}</span>
                  </div>
                  <div>
                    Actor Role: <span className={styles.metaValue}>{log.actorRole || "-"}</span>
                  </div>
                  <div>
                    Entity Type: <span className={styles.metaValue}>{log.entityType || "-"}</span>
                  </div>
                  <div>
                    Entity ID: <span className={styles.metaValue}>{log.entityId || "-"}</span>
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
