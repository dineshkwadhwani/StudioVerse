"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import styles from "./SuperAdminPortal.module.css";
import { db } from "@/services/firebase";
import { approveCoinRequest, denyCoinRequest } from "@/services/wallet.service";
import type { CoinRequest } from "@/types/coinRequest";

type Props = {
  operatorId: string;
  onRequestsChanged?: () => void;
};

function mapCoinRequestDoc(id: string, data: Record<string, unknown>): CoinRequest {
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    requesterProfessionalId: String(data.requesterProfessionalId ?? ""),
    requesterName: String(data.requesterName ?? ""),
    companyId: String(data.companyId ?? ""),
    companyName: String(data.companyName ?? ""),
    amount: Number(data.amount ?? 0),
    message: typeof data.message === "string" ? data.message : undefined,
    status: (data.status as CoinRequest["status"]) ?? "pending",
    approvalComment: typeof data.approvalComment === "string" ? data.approvalComment : undefined,
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedAt: data.approvedAt as CoinRequest["approvedAt"],
    deniedBy: typeof data.deniedBy === "string" ? data.deniedBy : undefined,
    deniedAt: data.deniedAt as CoinRequest["deniedAt"],
    createdAt: data.createdAt as CoinRequest["createdAt"],
    updatedAt: data.updatedAt as CoinRequest["updatedAt"],
  };
}

export default function CoinRequestsSection({ operatorId, onRequestsChanged }: Props) {
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState("");
  const [tenantOptions, setTenantOptions] = useState<string[]>([]);
  const [denialReasons, setDenialReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredRequests = useMemo(() => {
    if (!tenantFilter) {
      return requests;
    }
    return requests.filter((request) => request.tenantId === tenantFilter);
  }, [requests, tenantFilter]);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const [pendingSnap, allSnap] = await Promise.all([
        getDocs(query(collection(db, "coinRequests"), where("status", "==", "pending"))),
        getDocs(collection(db, "coinRequests")),
      ]);

      const rows = pendingSnap.docs
        .map((entry) => mapCoinRequestDoc(entry.id, entry.data() as Record<string, unknown>))
        .sort((a, b) => b.amount - a.amount);

      setRequests(rows);
      setTenantOptions(
        Array.from(new Set(allSnap.docs.map((row) => String(row.data().tenantId ?? "")).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b)
        )
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load coin requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function approve(requestId: string) {
    setBusyId(requestId);
    setError("");
    setMessage("");

    try {
      await approveCoinRequest({
        requestId,
        approvedBy: operatorId,
        comment: "Approved by SuperAdmin",
      });
      setMessage("Coin request approved.");
      await refresh();
      onRequestsChanged?.();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Failed to approve coin request.");
    } finally {
      setBusyId(null);
    }
  }

  async function deny(requestId: string) {
    const reason = (denialReasons[requestId] || "").trim();
    if (!reason) {
      setError("Please enter denial reason before rejecting the request.");
      return;
    }

    setBusyId(requestId);
    setError("");
    setMessage("");

    try {
      await denyCoinRequest({
        requestId,
        deniedBy: operatorId,
        reason,
      });
      setMessage("Coin request denied.");
      await refresh();
      onRequestsChanged?.();
    } catch (denyError) {
      setError(denyError instanceof Error ? denyError.message : "Failed to deny coin request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Coin Requests</h2>
      <p className={styles.subtitle}>Review pending coin requests from professionals to their associated companies.</p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <select
            className={styles.select}
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
            style={{ minWidth: 220, marginBottom: 0 }}
          >
            <option value="">All tenants</option>
            {tenantOptions.map((tenantId) => (
              <option key={tenantId} value={tenantId}>
                {tenantId}
              </option>
            ))}
          </select>
          <button type="button" className={styles.button} onClick={() => void refresh()}>
            Refresh Requests
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading coin requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className={styles.emptyCard}>No pending coin requests.</div>
      ) : (
        <div className={styles.programGrid}>
          {filteredRequests.map((request) => (
            <article key={request.id} className={styles.programTile}>
              <div className={styles.programContent}>
                <p className={styles.programTitle}>{request.requesterName}</p>
                <p className={styles.programMeta}>Company: {request.companyName || request.companyId}</p>
                <p className={styles.programMeta}>Tenant: {request.tenantId}</p>
                <p className={styles.programMeta}>Requested Credits: {request.amount}</p>
                {request.message ? <p className={styles.programMeta}>Requester Note: {request.message}</p> : null}

                <label className={styles.label} htmlFor={`coin-deny-reason-${request.id}`}>
                  Denial Reason (required for deny)
                </label>
                <textarea
                  id={`coin-deny-reason-${request.id}`}
                  className={styles.input}
                  rows={3}
                  value={denialReasons[request.id] ?? ""}
                  onChange={(event) =>
                    setDenialReasons((prev) => ({
                      ...prev,
                      [request.id]: event.target.value,
                    }))
                  }
                />
              </div>

              <div className={styles.programActions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => void approve(request.id)}
                  disabled={busyId === request.id}
                >
                  {busyId === request.id ? "Processing..." : "Approve"}
                </button>
                <button
                  type="button"
                  className={styles.rowAction}
                  onClick={() => void deny(request.id)}
                  disabled={busyId === request.id}
                  style={{ color: "#c0392b" }}
                >
                  {busyId === request.id ? "..." : "Deny"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
