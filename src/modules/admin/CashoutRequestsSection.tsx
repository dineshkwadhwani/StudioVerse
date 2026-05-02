"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  approveCashoutRequest,
  denyCashoutRequest,
  listCashoutRequests,
} from "@/services/wallet.service";
import type { CashoutRequest } from "@/types/cashoutRequest";

type Props = {
  operatorId: string;
};

export default function CashoutRequestsSection({ operatorId }: Props) {
  const [requests, setRequests] = useState<CashoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [tenantOptions, setTenantOptions] = useState<string[]>([]);
  const [denialReasons, setDenialReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredRequests = useMemo(() => {
    if (statusFilter === "all") {
      return requests;
    }
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      const [rows, allRows] = await Promise.all([
        listCashoutRequests({ tenantId: tenantFilter || undefined }),
        listCashoutRequests(),
      ]);

      setRequests(rows);
      setTenantOptions(Array.from(new Set(allRows.map((row) => row.tenantId))).sort((a, b) => a.localeCompare(b)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load cashout requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [tenantFilter]);

  async function approve(requestId: string) {
    setBusyId(requestId);
    setError("");
    setMessage("");

    try {
      await approveCashoutRequest({
        requestId,
        approvedBy: operatorId,
        comment: "Approved. Payout queued to Razorpay placeholder.",
      });
      setMessage("Cashout request approved and queued for payout placeholder.");
      await refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Failed to approve cashout request.");
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
      await denyCashoutRequest({
        requestId,
        deniedBy: operatorId,
        reason,
      });
      setMessage("Cashout request denied and credits returned to requester wallet.");
      await refresh();
    } catch (denyError) {
      setError(denyError instanceof Error ? denyError.message : "Failed to deny cashout request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Cashout Requests</h2>
      <p className={styles.subtitle}>
        Review pending cashout requests from company users and independent coaches.
      </p>

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
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "approved")}
            style={{ minWidth: 220, marginBottom: 0 }}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
          <button type="button" className={styles.button} onClick={() => void refresh()}>
            Refresh Requests
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {message ? <p className={styles.info}>{message}</p> : null}

      {loading ? (
        <div className={styles.emptyCard}>Loading cashout requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className={styles.emptyCard}>No cashout requests found.</div>
      ) : (
        <div className={styles.programGrid}>
          {filteredRequests.map((request) => {
            const isPending = request.status === "pending";
            const markdownAmount = Math.max(0, request.grossAmountRs - request.payoutAmountRs);

            return (
              <article key={request.id} className={styles.programTile}>
                <div className={styles.programContent}>
                  <p className={styles.programTitle}>{request.requesterName}</p>
                  <p className={styles.programDescription}>{request.requesterUserType === "company" ? "Company" : "Independent Coach"}</p>
                  {request.requesterUserType === "company" ? (
                    <p className={styles.programMeta}>Company: {request.requesterCompanyName || request.requesterName}</p>
                  ) : null}
                  <p className={styles.programMeta}>Tenant: {request.tenantId}</p>
                  <p className={styles.programMeta}>Credits Requested: {request.creditsRequested}</p>
                  <p className={styles.programMeta}>Credit Cost: Rs {request.creditCost.toFixed(2)}</p>
                  <p className={styles.programMeta}>Gross Value: Rs {request.grossAmountRs.toFixed(2)}</p>
                  <p className={styles.programMeta}>Cashback: {request.cashbackPercentage.toFixed(2)}%</p>
                  <p className={styles.programMeta}>Markdown: Rs {markdownAmount.toFixed(2)}</p>
                  <p className={styles.programMeta}>Payout Amount: Rs {request.payoutAmountRs.toFixed(2)}</p>
                  <p className={styles.programMeta}>Status: {request.status.toUpperCase()}</p>
                  {request.requestComment ? (
                    <p className={styles.programMeta}>Requester Note: {request.requestComment}</p>
                  ) : null}
                  {!isPending && request.denialReason ? (
                    <p className={styles.programMeta}>Denial Reason: {request.denialReason}</p>
                  ) : null}
                  {!isPending && request.payoutStatus ? (
                    <p className={styles.programMeta}>Payout Status: {request.payoutStatus}</p>
                  ) : null}

                  {isPending ? (
                    <>
                      <label className={styles.label} htmlFor={`deny-reason-${request.id}`}>
                        Denial Reason (required for deny)
                      </label>
                      <textarea
                        id={`deny-reason-${request.id}`}
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
                    </>
                  ) : null}
                </div>

                {isPending ? (
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
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </article>
  );
}
