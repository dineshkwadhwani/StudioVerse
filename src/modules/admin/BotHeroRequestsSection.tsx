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

type Props = {
  operatorId: string;
  onRequestsChanged?: () => void;
};

export default function BotHeroRequestsSection({ operatorId, onRequestsChanged }: Props) {
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
      onRequestsChanged?.();
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
      onRequestsChanged?.();
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

      {message && <p className={styles.info}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loadingText}>Loading requests…</p>      ) : requests.length === 0 ? (
        <div className={styles.emptyCard}>No pending Bot Hero requests.</div>
      ) : (
        <div className={styles.programGrid}>
          {requests.map((req) => {
            const previewStart = startDates[req.id];
            const previewEnd = previewStart
              ? calcEndDate(previewStart, req.durationValue, req.durationUnit)
              : null;
            const busy = actionId === req.id;

            return (
              <article key={req.id} className={styles.programTile}>
                <div className={styles.programImageWrap}>
                  {req.professionalAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={req.professionalAvatar} alt={req.professionalName} className={styles.programImage} style={{ objectFit: "cover" }} loading="lazy" />
                  ) : (
                    <div className={styles.programImage} style={{ background: "#d6eaf8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#134267", fontWeight: 700, fontSize: "1.2rem" }}>
                        {req.professionalName.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.programContent}>
                  <p className={styles.programTitle}>{req.professionalName}</p>
                  <p className={styles.programMeta}>Package: <strong>{req.packageName}</strong></p>
                  <p className={styles.programMeta}>{req.durationValue} {req.durationUnit} &nbsp;|&nbsp; {req.credits} credits</p>
                  {req.preferredStartDate && (
                    <p className={styles.programMeta}>Preferred start: {req.preferredStartDate}</p>
                  )}

                  <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <label className={styles.label} style={{ margin: 0 }}>Start Date</label>
                    <input
                      type="date"
                      className={styles.input}
                      style={{ width: "160px", marginBottom: 0 }}
                      min={todayIso}
                      value={startDates[req.id] ?? ""}
                      onChange={(e) => setStartDates((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                  </div>
                  {previewEnd && (
                    <p className={styles.programMeta} style={{ marginTop: "4px" }}>
                      Calculated end: <strong>{previewEnd}</strong>
                    </p>
                  )}
                </div>

                <div className={styles.programActions}>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => void handleApprove(req)}
                    disabled={busy}
                  >
                    {busy ? "…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.rowAction}
                    onClick={() => void handleDeny(req)}
                    disabled={busy}
                    style={{ color: "#c0392b" }}
                  >
                    {busy ? "…" : "Deny"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </article>
  );
}

