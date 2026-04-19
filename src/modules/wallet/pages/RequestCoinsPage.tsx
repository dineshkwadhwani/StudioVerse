"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import { getUserProfile } from "@/services/profile.service";
import { requestCoins } from "@/services/wallet.service";
import type { TenantConfig } from "@/types/tenant";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";

type RequestCoinsPageProps = {
  tenantConfig?: TenantConfig;
};

export default function RequestCoinsPage({ tenantConfig = coachingTenantConfig }: RequestCoinsPageProps) {
  const router = useRouter();
  const basePath = `/${tenantConfig.id}`;

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      try {
        const profile = await getUserProfile({
          userId: firebaseUser.uid,
          tenantId: tenantConfig.id,
        });

        if (!profile) {
          throw new Error("User profile not found");
        }

        if (profile.userType !== "professional") {
          throw new Error("Only professionals can request coins");
        }

        setUserId(firebaseUser.uid);
        setUserName(profile.fullName || "Professional");

        const userDocSnap = await getDoc(doc(db, "users", firebaseUser.uid));
        const userData = userDocSnap.data() as Record<string, unknown> | undefined;

        if (!userData?.associatedCompanyId) {
          throw new Error("Not associated with a company");
        }

        setCompanyId(String(userData.associatedCompanyId));
        setCompanyName(typeof userData.associatedCompanyName === "string" ? userData.associatedCompanyName : "Your Company");
        setError("");
      } catch (loadError) {
        const messageText = loadError instanceof Error ? loadError.message : "Failed to load profile";
        setError(messageText);
      } finally {
        setBusy(false);
      }
    });

    return () => unsubscribe();
  }, [basePath, tenantConfig.id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userId || !companyId) {
      setError("User or company information not loaded");
      return;
    }

    const coinAmount = parseInt(amount, 10);
    if (isNaN(coinAmount) || coinAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const requestId = await requestCoins({
        tenantId: tenantConfig.id,
        professionalId: userId,
        professionalName: userName,
        companyId,
        companyName,
        amount: coinAmount,
        message: message.trim(),
      });

      setSuccess(`Coin request submitted successfully! Request ID: ${requestId}`);
      setAmount("");
      setMessage("");

      setTimeout(() => {
        router.push(`${basePath}/manage-wallet`);
      }, 2000);
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : "Failed to request coins";
      setError(messageText);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px", background: "#ffffff" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link href={`${basePath}/manage-wallet`}>
          <button
            type="button"
            style={{
              border: "none",
              borderRadius: "6px",
              padding: "8px 16px",
              background: "#1e5a96",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← Back
          </button>
        </Link>
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "#133a56" }}>Request Coins</h1>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>Request coins from your associated company.</p>

      {busy && !error && !userId ? (
        <div style={{ color: "#666", padding: "16px", background: "#f0f0f0", borderRadius: "8px" }}>Loading profile...</div>
      ) : null}

      {error && (
        <div style={{ color: "#b3261e", background: "#fce8e6", padding: "12px", borderRadius: "8px", marginBottom: "24px" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: "#1a6189", background: "#e8f5ff", padding: "12px", borderRadius: "8px", marginBottom: "24px" }}>
          ✓ {success}
        </div>
      )}

      {!busy && userId && !error && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "8px" }}>Your Name</label>
            <input
              type="text"
              value={userName}
              disabled
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #c6dcea",
                borderRadius: "8px",
                background: "#f8fcff",
                color: "#4d6e86",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "8px" }}>Requesting From</label>
            <input
              type="text"
              value={companyName}
              disabled
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #c6dcea",
                borderRadius: "8px",
                background: "#f8fcff",
                color: "#4d6e86",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "8px" }}>Number of Coins *</label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #c6dcea",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: "8px" }}>Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to your request..."
              rows={4}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #c6dcea",
                borderRadius: "8px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-start" }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                background: busy ? "#ccc" : "#1e5a96",
                color: "#fff",
                padding: "10px 24px",
                border: "none",
                borderRadius: "6px",
                fontWeight: 700,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Submitting..." : "Submit Request"}
            </button>
            <Link href={`${basePath}/manage-wallet`}>
              <button
                type="button"
                style={{
                  background: "#e0e0e0",
                  color: "#333",
                  padding: "10px 24px",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
