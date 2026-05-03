"use client";

import { useEffect, useState } from "react";
import styles from "./ManageOrdersSection.module.css";
import { listAllCoinOrders } from "@/services/coinOrders.service";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { CoinOrderRecord, CoinOrderStatus } from "@/types/coinOrder";

function statusBadgeStyle(status: CoinOrderStatus): string {
  if (status === "completed") return styles.badgeActive;
  if (status === "failed") return styles.badgeInactive;
  return styles.badgePending;
}

function formatDate(ts: CoinOrderRecord["createdAt"]): string {
  if (!ts || !("toDate" in ts) || typeof ts.toDate !== "function") return "—";
  return ts.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function ManageOrdersSection() {
  const [orders, setOrders] = useState<CoinOrderRecord[]>([]);
  const [tenants, setTenants] = useState<Array<{ tenantId: string; tenantName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CoinOrderStatus | "all">("all");
  const [appliedFilters, setAppliedFilters] = useState<{
    tenantId: string;
    fromDate: string;
    toDate: string;
    status: CoinOrderStatus | "all";
  }>({
    tenantId: "all",
    fromDate: "",
    toDate: "",
    status: "all",
  });

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [coinOrders, tenantsSnap] = await Promise.all([
        listAllCoinOrders(),
        getDocs(collection(db, "tenants")),
      ]);
      setOrders(coinOrders);
      setTenants(
        tenantsSnap.docs
          .map((row) => {
            const data = row.data() as Record<string, unknown>;
            return {
              tenantId: String(data.tenantId ?? row.id),
              tenantName: String(data.tenantName ?? data.tenantId ?? row.id),
            };
          })
          .sort((a, b) => a.tenantName.localeCompare(b.tenantName))
      );
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  function runSearch(): void {
    setAppliedFilters({
      tenantId: tenantFilter,
      fromDate,
      toDate,
      status: statusFilter,
    });
  }

  const filtered = orders.filter((order) => {
    if (appliedFilters.tenantId !== "all" && order.tenantId !== appliedFilters.tenantId) {
      return false;
    }

    if (appliedFilters.status !== "all" && order.status !== appliedFilters.status) {
      return false;
    }

    if (appliedFilters.fromDate && order.createdAt && "toDate" in order.createdAt) {
      const from = new Date(`${appliedFilters.fromDate}T00:00:00`);
      if (order.createdAt.toDate() < from) {
        return false;
      }
    }

    if (appliedFilters.toDate && order.createdAt && "toDate" in order.createdAt) {
      const to = new Date(`${appliedFilters.toDate}T23:59:59.999`);
      if (order.createdAt.toDate() > to) {
        return false;
      }
    }

    return true;
  });

  return (
    <section className={styles.layout}>
      <article className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div>
            <h2 className={styles.title}>Coin Orders</h2>
            <p className={styles.contextText}>
            All coin purchase orders placed by users across the platform.
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshIconButton}
            onClick={refresh}
            disabled={loading}
            title="Refresh orders"
            aria-label="Refresh orders"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.filterGrid}>
          <label className={styles.filterField}>
          <span className={styles.filterLabel}>Tenant</span>
          <select
            className={styles.filterSelect}
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
          >
            <option value="all">All Tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.tenantId} value={tenant.tenantId}>
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
          <span className={styles.filterLabel}>Status</span>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CoinOrderStatus | "all")}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          </label>

          <div className={styles.searchActions}>
            <button type="button" className={styles.searchButton} onClick={runSearch} disabled={loading}>
              Search
            </button>
          </div>
        </div>
      </article>

      <article className={styles.contentCard}>
        <h3 className={styles.contentHeading}>Order Results</h3>

        {loading ? (
          <p className={styles.infoText}>Loading orders...</p>
        ) : filtered.length === 0 ? (
          <p className={styles.infoText}>No orders found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Tenant</th>
                <th>Package</th>
                <th>Credits</th>
                <th>Amount (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDate(order.createdAt)}
                  </td>
                  <td>
                    <strong>{order.userName}</strong>
                    <br />
                    <span className={styles.userType}>{order.userType}</span>
                  </td>
                  <td>{order.tenantId}</td>
                  <td>{order.packageName}</td>
                  <td>{order.credits}</td>
                  <td>₹{order.priceInr.toLocaleString("en-IN")}</td>
                  <td>
                    <span className={statusBadgeStyle(order.status)}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
