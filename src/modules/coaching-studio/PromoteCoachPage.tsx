"use client";

import { useEffect, useState } from "react";
import type { TenantConfig } from "@/types/tenant";
import {
  getBotHeroPackageSummary,
  getActiveBotHero,
  listActiveBotHeroPackages,
  listBotHeroRequestsForProfessional,
  submitBotHeroRequest,
} from "@/services/botHero.service";
import { BOT_HERO_STATUS_LABELS, type BotHeroPackageRecord, type BotHeroRequestRecord } from "@/types/botHero";
import styles from "./PromoteCoachPage.module.css";

type Props = {
  tenantConfig: TenantConfig;
  currentUser: {
    uid: string;
    name: string;
    avatarUrl?: string;
  };
};

function StatusBadge({ status }: { status: BotHeroRequestRecord["status"] }) {
  const label = BOT_HERO_STATUS_LABELS[status] ?? status;
  const colorMap: Record<string, string> = {
    pending: styles.badgePending,
    approved: styles.badgeApproved,
    active: styles.badgeActive,
    expired: styles.badgeExpired,
    denied: styles.badgeDenied,
  };
  return <span className={`${styles.badge} ${colorMap[status] ?? ""}`}>{label}</span>;
}

export default function PromoteCoachPage({ tenantConfig, currentUser }: Props) {
  const [packages, setPackages] = useState<BotHeroPackageRecord[]>([]);
  const [requests, setRequests] = useState<BotHeroRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [preferredDates, setPreferredDates] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const hasAvatar = Boolean(currentUser.avatarUrl?.trim());

  async function refresh() {
    setLoading(true);
    try {
      const [pkgs, reqs] = await Promise.all([
        listActiveBotHeroPackages(),
        listBotHeroRequestsForProfessional(currentUser.uid),
      ]);
      setPackages(pkgs);
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function handlePurchase(pkg: BotHeroPackageRecord) {
    if (!hasAvatar) {
      setError("You must upload a profile picture before becoming a Bot Hero. Update your profile first.");
      return;
    }
    setSubmitting(pkg.id);
    setError("");
    setMessage("");
    try {
      await submitBotHeroRequest({
        tenantId: tenantConfig.id,
        professionalId: currentUser.uid,
        professionalName: currentUser.name,
        professionalAvatar: currentUser.avatarUrl ?? "",
        pkg,
        preferredStartDate: preferredDates[pkg.id] ?? undefined,
      });
      setMessage(`Bot Hero request submitted for "${pkg.name}". Credits have been deducted. Awaiting Super Admin approval.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit Bot Hero request.");
    } finally {
      setSubmitting(null);
    }
  }

  const todayIso = new Date().toISOString().split("T")[0];

  return (
    <div className={styles.layout}>
      <section className={styles.heroCard}>
        <h2 className={styles.title}>Promote Coach</h2>
        <p className={styles.contextText}>
          Become the face of the {tenantConfig.name} bot widget for a defined period. Purchase a Bot Hero package and your profile picture and name will appear on the bot for all visitors.
        </p>

        {!hasAvatar && (
          <div className={styles.warningBanner}>
            ⚠️ A profile picture is required to submit a Bot Hero request. Please update your profile before purchasing.
          </div>
        )}

        {message && <p className={styles.successMessage}>{message}</p>}
        {error && <p className={styles.errorMessage}>{error}</p>}

        {loading ? (
          <p className={styles.loadingText}>Loading packages…</p>
        ) : packages.length === 0 ? (
          <p className={styles.infoText}>No Bot Hero packages are currently available. Check back soon.</p>
        ) : (
          <div className={styles.packageGrid}>
            {packages.map((pkg) => (
              <div key={pkg.id} className={styles.packageCard}>
                <h3 className={styles.packageName}>{pkg.name}</h3>
                {pkg.description && <p className={styles.packageDesc}>{pkg.description}</p>}
                <p className={styles.packageMeta}>{getBotHeroPackageSummary(pkg)}</p>

                <label className={styles.preferredDateLabel}>
                  <span>Preferred start date (optional)</span>
                  <input
                    type="date"
                    className={styles.dateInput}
                    min={todayIso}
                    value={preferredDates[pkg.id] ?? ""}
                    onChange={(e) => setPreferredDates((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                  />
                </label>

                <button
                  type="button"
                  className={styles.purchaseBtn}
                  disabled={!hasAvatar || submitting === pkg.id}
                  onClick={() => void handlePurchase(pkg)}
                >
                  {submitting === pkg.id ? "Submitting…" : `Buy for ${pkg.credits} credits`}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.contentCard}>
        <h3 className={styles.sectionTitle}>My Bot Hero Requests</h3>
        {loading ? (
          <p className={styles.loadingText}>Loading history…</p>
        ) : requests.length === 0 ? (
          <p className={styles.infoText}>No Bot Hero requests yet.</p>
        ) : (
          <div className={styles.requestList}>
            {requests.map((req) => (
              <div key={req.id} className={styles.requestCard}>
                <div className={styles.requestCardRow}>
                  <div>
                    <p className={styles.requestPackage}>{req.packageName}</p>
                    <p className={styles.requestMeta}>
                      {req.durationValue} {req.durationUnit} &nbsp;|&nbsp; {req.credits} credits
                    </p>
                    {req.approvedStartDate && (
                      <p className={styles.requestMeta}>
                        Active: {req.approvedStartDate} → {req.approvedEndDate}
                      </p>
                    )}
                    {req.denialReason && (
                      <p className={styles.denialReason}>Denied: {req.denialReason}</p>
                    )}
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
