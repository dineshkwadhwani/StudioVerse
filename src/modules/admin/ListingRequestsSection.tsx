"use client";

import { useEffect, useState } from "react";
import styles from "./SuperAdminPortal.module.css";
import {
  approveListingRequest,
  denyListingRequest,
  listListingRequests,
  type ListingRequestRecord,
} from "@/services/listingRequests.service";
import { listListingPackages } from "@/services/listingPackages.service";
import { LISTING_RESOURCE_LABELS, type ListingPackageRecord } from "@/types/listingPackage";

type Props = {
  operatorId: string;
};

export default function ListingRequestsSection({ operatorId }: Props) {
  const [requests, setRequests] = useState<ListingRequestRecord[]>([]);
  const [packagesById, setPackagesById] = useState<Record<string, ListingPackageRecord>>({});
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantOptions, setTenantOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");

    try {
      const [rows, allRows, allPackages] = await Promise.all([
        listListingRequests(selectedTenantId || undefined),
        listListingRequests(),
        listListingPackages(),
      ]);

      setRequests(rows);
      setTenantOptions(Array.from(new Set(allRows.map((row) => row.tenantId))).sort((a, b) => a.localeCompare(b)));
      setPackagesById(
        allPackages.reduce<Record<string, ListingPackageRecord>>((acc, pkg) => {
          acc[pkg.id] = pkg;
          return acc;
        }, {}),
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load listing requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [selectedTenantId]);

  async function approve(request: ListingRequestRecord): Promise<void> {
    setApprovingId(request.id);
    setError("");
    setMessage("");
    try {
      await approveListingRequest({ resourceType: request.resourceType, id: request.id, operatorId });
      setMessage("Listing request approved.");
      await refresh();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Failed to approve listing request.");
    } finally {
      setApprovingId(null);
    }
  }

  async function deny(request: ListingRequestRecord): Promise<void> {
    setDenyingId(request.id);
    setError("");
    setMessage("");
    try {
      await denyListingRequest({ resourceType: request.resourceType, id: request.id, operatorId });
      setMessage("Listing request denied.");
      await refresh();
    } catch (denyError) {
      setError(denyError instanceof Error ? denyError.message : "Failed to deny listing request.");
    } finally {
      setDenyingId(null);
    }
  }

  return (
    <article className={styles.card}>
      <h2>Listing Requests</h2>
      <p className={styles.subtitle}>
        Approve pending Program, Event, and Assessment publication requests submitted with listing packages.
      </p>

      <div className={styles.controlCard}>
        <div className={styles.actions}>
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
        <div className={styles.emptyCard}>Loading listing requests...</div>
      ) : requests.length === 0 ? (
        <div className={styles.emptyCard}>No pending listing requests.</div>
      ) : (
        <div className={styles.programGrid}>
          {requests.map((request) => {
            const pkg = request.listingPackageId ? packagesById[request.listingPackageId] : undefined;

            return (
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
                        {LISTING_RESOURCE_LABELS[request.resourceType]}
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.programContent}>
                  <p className={styles.programTitle}>{request.name}</p>
                  <p className={styles.programDescription}>{request.shortDescription}</p>
                  <p className={styles.programMeta}>Tenant: {request.tenantId}</p>
                  <p className={styles.programMeta}>Resource: {LISTING_RESOURCE_LABELS[request.resourceType]}</p>
                  <p className={styles.programMeta}>Listing Package: {pkg?.name ?? "-"}</p>
                  <p className={styles.programMeta}>Listing Cost: {pkg ? `${pkg.costCredits} credits` : "-"}</p>
                </div>

                <div className={styles.programActions}>
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => void approve(request)}
                    disabled={approvingId === request.id || denyingId === request.id}
                  >
                    {approvingId === request.id ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.rowAction}
                    onClick={() => void deny(request)}
                    disabled={approvingId === request.id || denyingId === request.id}
                    style={{ color: "#c0392b" }}
                  >
                    {denyingId === request.id ? "..." : "Deny"}
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
