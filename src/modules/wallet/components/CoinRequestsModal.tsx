"use client";

import { useEffect, useState } from "react";
import { getCoinRequestsForCompanyContext, approveCoinRequest, denyCoinRequest } from "@/services/wallet.service";
import type { CoinRequest } from "@/types/coinRequest";
import styles from "../pages/ManageWalletPage.module.css";

type CoinRequestsModalProps = {
  companyIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onPendingCountChange?: (count: number) => void;
};

export default function CoinRequestsModal({
  companyIds,
  isOpen,
  onClose,
  onPendingCountChange,
}: CoinRequestsModalProps) {
  const [requests, setRequests] = useState<CoinRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function loadRequests() {
      setBusy(true);
      setError("");

      try {
        console.log("[CoinRequestsModal] Opening with companyIds:", companyIds);
        const fetchedRequests = await getCoinRequestsForCompanyContext(companyIds);
        console.log("[CoinRequestsModal] Loaded requests:", fetchedRequests.length);
        setRequests(fetchedRequests);
        onPendingCountChange?.(fetchedRequests.filter((request) => request.status === "pending").length);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load requests";
        console.error("[CoinRequestsModal] Error loading requests:", message);
        setError(message);
      } finally {
        setBusy(false);
      }
    }

    void loadRequests();
  }, [isOpen, companyIds, onPendingCountChange]);

  async function handleApprove(requestId: string) {
    setProcessingId(requestId);
    setError("");

    try {
      await approveCoinRequest({
        requestId,
        approvedBy: "company",
        comment: "Approved",
      });

      // Remove from list and refresh
      setRequests((prev) => {
        const nextRequests = prev.map((r) => (r.id === requestId ? { ...r, status: "approved" as const } : r));
        onPendingCountChange?.(nextRequests.filter((request) => request.status === "pending").length);
        return nextRequests;
      });
    } catch (approveError) {
      const message = approveError instanceof Error ? approveError.message : "Failed to approve request";
      setError(message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeny(requestId: string) {
    setProcessingId(requestId);
    setError("");

    try {
      await denyCoinRequest({
        requestId,
        deniedBy: "company",
        reason: "Denied by company",
      });

      // Remove from list and refresh
      setRequests((prev) => {
        const nextRequests = prev.map((r) => (r.id === requestId ? { ...r, status: "denied" as const } : r));
        onPendingCountChange?.(nextRequests.filter((request) => request.status === "pending").length);
        return nextRequests;
      });
    } catch (denyError) {
      const message = denyError instanceof Error ? denyError.message : "Failed to deny request";
      setError(message);
    } finally {
      setProcessingId(null);
    }
  }

  if (!isOpen) return null;

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(19, 58, 86, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 12px 24px rgba(19, 58, 86, 0.12)",
          maxWidth: "700px",
          width: "90%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "#133a56" }}>
            Coin Requests ({requests.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "#4d6e86",
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ color: "#b3261e", background: "#fce8e6", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {busy && <div style={{ color: "#4d6e86", textAlign: "center", padding: "24px" }}>Loading requests...</div>}

        {!busy && requests.length === 0 && (
          <div style={{ color: "#4d6e86", textAlign: "center", padding: "24px" }}>
            No coin requests found.
          </div>
        )}

        {!busy && pendingRequests.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, color: "#133a56" }}>
              Pending Requests ({pendingRequests.length})
            </h3>
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid #c6dcea",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "12px",
                  background: "#f8fcff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                  <div>
                    <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#133a56" }}>
                      {request.requesterName}
                    </p>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#4d6e86" }}>
                      Requesting: <strong>{request.amount} coins</strong>
                    </p>
                  </div>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#1a6189", background: "#eef8ff", padding: "4px 8px", borderRadius: "6px" }}>
                    PENDING
                  </span>
                </div>

                {request.message && (
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.9rem", color: "#4d6e86", fontStyle: "italic" }}>
                    "{request.message}"
                  </p>
                )}

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "linear-gradient(90deg, #1f5c9c 0%, #2bb6d1 100%)",
                      color: "#fff",
                      border: 0,
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: processingId === request.id ? "not-allowed" : "pointer",
                      opacity: processingId === request.id ? 0.6 : 1,
                    }}
                  >
                    {processingId === request.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeny(request.id)}
                    disabled={processingId === request.id}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "#fff",
                      color: "#b3261e",
                      border: "1px solid #c6dcea",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: processingId === request.id ? "not-allowed" : "pointer",
                      opacity: processingId === request.id ? 0.6 : 1,
                    }}
                  >
                    {processingId === request.id ? "Processing..." : "Deny"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!busy && processedRequests.length > 0 && (
          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, color: "#133a56" }}>
              Request History
            </h3>
            {processedRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "8px",
                  background: "#fafafa",
                  opacity: 0.7,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <p style={{ margin: "0 0 4px 0", fontSize: "0.9rem", fontWeight: 700, color: "#133a56" }}>
                      {request.requesterName} • {request.amount} coins
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: request.status === "approved" ? "#1b5e20" : "#b3261e",
                      background: request.status === "approved" ? "#e8f5e9" : "#fce8e6",
                      padding: "3px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "24px", textAlign: "right" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              border: "1px solid #c6dcea",
              borderRadius: "8px",
              background: "#fff",
              color: "#133a56",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
