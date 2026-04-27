"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import { listAllCoinOrders } from "@/services/coinOrders.service";
import type { CoinOrderRecord, CoinOrderStatus } from "@/types/coinOrder";

function statusBadgeStyle(status: CoinOrderStatus): string {
  if (status === "completed") return styles.badgeActive;
  if (status === "failed") return styles.badgeInactive;
  return styles.badgePending ?? styles.badgeInactive;
}

function formatDate(ts: CoinOrderRecord["createdAt"]): string {
  if (!ts || !("toDate" in ts) || typeof ts.toDate !== "function") return "—";
  return ts.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function ManageOrdersSection() {
  const [orders, setOrders] = useState<CoinOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<CoinOrderStatus | "all">("all");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setOrders(await listAllCoinOrders());
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filtered = statusFilter === "all"
    ? orders
    : orders.filter((o) => o.status === statusFilter);

  return (
    <div className={styles.sectionWrap}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Coin Orders</h2>
          <p className={styles.sectionSub}>
            All coin purchase orders placed by users across the platform.
          </p>
        </div>
        <button type="button" className={styles.secondaryButton} onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? <p className={styles.errorMsg}>{error}</p> : null}

      <div style={{ display: "flex", gap: "10px", margin: "16px 0", flexWrap: "wrap" }}>
        {(["all", "pending", "completed", "failed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 16px",
              borderRadius: "20px",
              border: "1.5px solid",
              borderColor: statusFilter === s ? "#01696f" : "#c6dcea",
              background: statusFilter === s ? "#01696f" : "#fff",
              color: statusFilter === s ? "#fff" : "#133a56",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.88rem",
              fontFamily: "inherit",
            }}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            {" "}
            ({s === "all" ? orders.length : orders.filter((o) => o.status === s).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading orders…</p>
      ) : filtered.length === 0 ? (
        <p className={styles.emptyState}>No orders found.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>User</th>
                <th className={styles.th}>Tenant</th>
                <th className={styles.th}>Package</th>
                <th className={styles.th}>Credits</th>
                <th className={styles.th}>Amount (₹)</th>
                <th className={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className={styles.tr}>
                  <td className={styles.td} style={{ whiteSpace: "nowrap" }}>
                    {formatDate(order.createdAt)}
                  </td>
                  <td className={styles.td}>
                    <strong>{order.userName}</strong>
                    <br />
                    <span style={{ fontSize: "0.78rem", color: "#4d6e86" }}>{order.userType}</span>
                  </td>
                  <td className={styles.td}>{order.tenantId}</td>
                  <td className={styles.td}>{order.packageName}</td>
                  <td className={styles.td}>{order.credits}</td>
                  <td className={styles.td}>₹{order.priceInr.toLocaleString("en-IN")}</td>
                  <td className={styles.td}>
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
    </div>
  );
}
