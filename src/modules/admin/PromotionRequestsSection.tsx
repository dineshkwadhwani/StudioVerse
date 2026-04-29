"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  approveAssessmentPromotionRequest,
  approveEventPromotionRequest,
  approveProgramPromotionRequest,
  listPromotionRequests,
  type PromotionRequestRecord,
} from "@/services/programPromotionRequests.service";
import { listPromotionPackages } from "@/services/promotionPackages.service";
import { PROMOTION_RESOURCE_LABELS, type PromotionPackageRecord } from "@/types/promotionPackage";
import { ASSESSMENT_PROMOTION_STATUS_LABELS } from "@/types/assessment";
import { PROGRAM_PROMOTION_STATUS_LABELS, type ProgramRecord } from "@/types/program";
import { EVENT_PROMOTION_STATUS_LABELS } from "@/types/event";

type Props = {
  operatorId: string;
  initialTenantId?: string;
  onBack: () => void;
};

export default function PromotionRequestsSection({ operatorId, initialTenantId, onBack }: Props) {
  const [requests, setRequests] = useState<PromotionRequestRecord[]>([]);
  const [packagesById, setPackagesById] = useState<Record<string, PromotionPackageRecord>>({});
  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId ?? "");
  const [tenantOptions, setTenantOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const [rows, allRows, allPackages] = await Promise.all([
        listPromotionRequests(selectedTenantId || undefined),
        listPromotionRequests(),
        listPromotionPackages(),
      ]);
      setRequests(rows);

      const tenantIds = Array.from(new Set(allRows.map((row) => row.tenantId))).sort((a, b) => a.localeCompare(b));
      setTenantOptions(tenantIds);

      const nextPackagesById = allPackages.reduce<Record<string, PromotionPackageRecord>>((acc, pkg) => {
        acc[pkg.id] = pkg;
        return acc;
      }, {});
      setPackagesById(nextPackagesById);
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load promotion requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [selectedTenantId]);

  useEffect(() => {
    setSelectedTenantId(initialTenantId ?? "");
  }, [initialTenantId]);

  async function approve(request: PromotionRequestRecord): Promise<void> {
    setApprovingId(request.id);
    setError("");
    setMessage("");
    try {
      if (request.resourceType === "event") {
        await approveEventPromotionRequest({ eventId: request.id, operatorId });
      } else if (request.resourceType === "assessment") {
        await approveAssessmentPromotionRequest({ assessmentId: request.id, operatorId });
      } else {
        await approveProgramPromotionRequest({ programId: request.id, operatorId });
      }
      setMessage("Promotion request approved.");
      await refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Failed to approve promotion request.");
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Promotion Requests</h2>
      <p className={styles.subtitle}>
        Approve pending Program, Event, and Assessment promotion requests from coaches and companies.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={onBack}>
            Back To Promotion Packages
          </button>
          <select
            className={styles.select}
            value={selectedTenantId}
            onChange={(event) => setSelectedTenantId(event.target.value)}
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
        <div className={styles.emptyCard}>Loading promotion requests…</div>
      ) : requests.length === 0 ? (
        <div className={styles.emptyCard}>No pending promotion requests.</div>
      ) : (
        <div className={styles.programGrid}>
          {requests.map((request) => (
            <article key={`${request.resourceType}-${request.id}`} className={styles.programTile}>
              <div className={styles.programImageWrap}>
                {request.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.programImage} src={request.thumbnailUrl} alt={request.name} loading="lazy" />
                ) : (
                  <div
                    className={styles.programImage}
                    style={{ background: "#d6eaf8", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <span style={{ color: "#134267", fontWeight: 700, fontSize: "0.8rem" }}>
                      {request.resourceType === "event" ? "Event" : request.resourceType === "assessment" ? "Assessment" : "Program"}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.programContent}>
                {(() => {
                  const pkg = request.promotionPackageId ? packagesById[request.promotionPackageId] : undefined;
                  const statusLabel = request.resourceType === "event"
                    ? EVENT_PROMOTION_STATUS_LABELS[request.promotionStatus]
                    : request.resourceType === "assessment"
                    ? ASSESSMENT_PROMOTION_STATUS_LABELS[request.promotionStatus]
                    : PROGRAM_PROMOTION_STATUS_LABELS[request.promotionStatus as ProgramRecord["promotionStatus"]];
                  return (
                    <>
                      <p className={styles.programTitle}>{request.name}</p>
                      <p className={styles.programDescription}>{request.shortDescription}</p>
                      <p className={styles.programMeta}>Tenant: {request.tenantId}</p>
                      <p className={styles.programMeta}>Promotion Package: {pkg?.name ?? "-"}</p>
                      <p className={styles.programMeta}>Promotion Resource: {pkg ? PROMOTION_RESOURCE_LABELS[pkg.resourceType] : "-"}</p>
                      <p className={styles.programMeta}>Promotion Status: {statusLabel}</p>
                    </>
                  );
                })()}
              </div>

              <div className={styles.programActions}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => void approve(request)}
                  disabled={approvingId === request.id}
                >
                  {approvingId === request.id ? "Approving..." : "Approve"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}
