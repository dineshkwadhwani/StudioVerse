"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  approveBotHeroRequest,
  calcEndDate,
  denyBotHeroRequest,
  listPendingBotHeroRequests,
} from "@/services/botHero.service";
import type { BotHeroRequestRecord } from "@/types/botHero";

type Props = { operatorId: string };

export default function BotHeroRequestsSection({ operatorId }: Props) {
  const [requests, setRequests] = useState<BotHeroRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [startDates, setStartDates] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setRequests(await listPendingBotHeroRequests());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function handleApprove(request: BotHeroRequestRecord) {
    const startDate = startDates[request.id];
    if (!startDate) {
      setError(`Select a start date for ${request.professionalName} before approving.`);
      return;
    }
    setActionId(request.id);
    setError("");
    setMessage("");
    try {
      await approveBotHeroRequest({ requestId: request.id, request, startDate, operatorId });
      const endDate = calcEndDate(startDate, request.durationValue, request.durationUnit);
      setMessage(`Approved. Bot Hero slot: ${startDate} → ${endDate}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeny(request: BotHeroRequestRecord) {
    setActionId(request.id);
    setError("");
    setMessage("");
    try {
      await denyBotHeroRequest({ requestId: request.id, request, operatorId });
      setMessage(`Denied. Credits refunded to ${request.professionalName}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deny request.");
    } finally {
      setActionId(null);
    }
  }

  const todayIso = new Date().toISOString().split("T")[0];

  return (
    <article className={styles.card}>
      <h2>Bot Hero Requests</h2>
      <p className={styles.subtitle}>
        Review and approve pending Bot Hero requests from coaches. Only one Bot Hero can be active at a time per tenant.
      </p>

      {message && <p className={styles.successMessage}>{message}</p>}
      {error && <p className={styles.errorMessage}>{error}</p>}

      {loading ? (
        <p className={styles.loadingText}>Loading requests…</p>
      ) : requests.length === 0 ? (
        <div className={styles.emptyCard}>No pending Bot Hero requests.</div>
      ) : (
        <div className={styles.requestList}>
          {requests.map((req) => {
            const previewStart = startDates[req.id];
            const previewEnd = previewStart
              ? calcEndDate(previewStart, req.durationValue, req.durationUnit)
              : null;
            const busy = actionId === req.id;

            return (
              <div key={req.id} className={styles.requestCard}>
                <div className={styles.requestCardRow}>
                  {req.professionalAvatar && (
                    <img src={req.professionalAvatar} alt={req.professionalName} className={styles.requestAvatar} />
                  )}
                  <div>
                    <p className={styles.requestName}>{req.professionalName}</p>
                    <p className={styles.requestMeta}>
                      Package: <strong>{req.packageName}</strong> &nbsp;|&nbsp;
                      {req.durationValue} {req.durationUnit} &nbsp;|&nbsp;
                      {req.credits} credits
                    </p>
                    {req.preferredStartDate && (
                      <p className={styles.requestMeta}>Preferred start: {req.preferredStartDate}</p>
                    )}
                  </div>
                </div>

                <div className={styles.requestApprovalRow}>
                  <label className={styles.filterField}>
                    <span className={styles.filterLabel}>Start Date</span>
                    <input
                      type="date"
                      className={styles.filterInput}
                      min={todayIso}
                      value={startDates[req.id] ?? ""}
                      onChange={(e) => setStartDates((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                  </label>
                  {previewEnd && (
                    <p className={styles.requestMeta}>
                      Calculated end: <strong>{previewEnd}</strong>
                    </p>
                  )}
                </div>

                <div className={styles.requestActions}>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => void handleApprove(req)}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => void handleDeny(req)}
                    disabled={busy}
                  >
                    {busy ? "Processing…" : "Deny"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

