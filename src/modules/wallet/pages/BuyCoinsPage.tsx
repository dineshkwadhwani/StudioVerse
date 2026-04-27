"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";
import { getUserById } from "@/services/manage-users.service";
import { listActiveCoinPackages } from "@/services/coinPackages.service";
import { createCoinOrder, updateCoinOrderStatus } from "@/services/coinOrders.service";
import { assignCoins } from "@/services/wallet.service";
import type { CoinPackageRecord } from "@/types/coinPackage";
import type { WalletUserType } from "@/types/wallet";
import styles from "./ManageWalletPage.module.css";
import buyStyles from "./BuyCoinsPage.module.css";

type BuyCoinsPageProps = {
  tenantId?: string;
};

type OrderFlow = "browse" | "summary" | "success" | "failed";

type RazorpayCreateOrderResponse = {
  orderId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
};

type RazorpayHandlerResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

type UserContext = {
  uid: string;
  profileId: string;
  name: string;
  userType: WalletUserType;
};

export default function BuyCoinsPage({ tenantId = "coaching-studio" }: BuyCoinsPageProps) {
  const router = useRouter();
  const basePath = `/${tenantId}`;

  const [userCtx, setUserCtx] = useState<UserContext | null>(null);
  const [packages, setPackages] = useState<CoinPackageRecord[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [selected, setSelected] = useState<CoinPackageRecord | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [flow, setFlow] = useState<OrderFlow>("browse");
  const [processing, setProcessing] = useState(false);
  const [initError, setInitError] = useState("");
  const paymentHandledRef = useRef(false);

  async function ensureRazorpayLoaded(): Promise<void> {
    if (typeof window !== "undefined" && window.Razorpay) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
      document.body.appendChild(script);
    });

    if (!window.Razorpay) {
      throw new Error("Razorpay checkout SDK unavailable.");
    }
  }

  async function postWithAuth<T>(url: string, token: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  // Resolve current user + load packages in parallel
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace(basePath);
        return;
      }

      const storedProfileId = sessionStorage.getItem("cs_profile_id");
      const storedRole = sessionStorage.getItem("cs_role");

      try {
        const resolvedUserId = storedProfileId ?? firebaseUser.uid;
        const [profile, pkgs] = await Promise.all([
          getUserById(resolvedUserId),
          listActiveCoinPackages(),
        ]);

        setUserCtx({
          uid: firebaseUser.uid,
          profileId: profile?.id ?? storedProfileId ?? firebaseUser.uid,
          name: profile?.fullName ?? "User",
          userType: (profile?.userType ?? storedRole ?? "individual") as WalletUserType,
        });
        setPackages(pkgs);
      } catch {
        setInitError("Failed to load your profile or packages. Please refresh.");
      } finally {
        setLoadingInit(false);
      }
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function handleSelectPackage(pkg: CoinPackageRecord) {
    setSelected(pkg);
    setFlow("summary");
  }

  async function handleConfirmOrder() {
    if (!selected || !userCtx) return;
    setProcessing(true);
    setInitError("");

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You are signed out. Please sign in again.");
      }

      const localOrderId = await createCoinOrder({
        userId: userCtx.profileId,
        userName: userCtx.name,
        tenantId,
        userType: userCtx.userType,
        packageId: selected.id,
        packageName: selected.name,
        credits: selected.credits,
        priceInr: selected.priceInr,
      });
      setOrderId(localOrderId);

      const token = await currentUser.getIdToken();
      const createOrder = await postWithAuth<RazorpayCreateOrderResponse>("/api/payments/razorpay/create-order", token, {
        amountPaise: Math.round(selected.priceInr * 100),
        receipt: localOrderId,
        notes: {
          internalOrderId: localOrderId,
          tenantId,
          packageId: selected.id,
          userId: userCtx.profileId,
        },
      });
      paymentHandledRef.current = false;

      await ensureRazorpayLoaded();
      const Razorpay = window.Razorpay;
      if (!Razorpay) {
        throw new Error("Unable to open Razorpay checkout.");
      }

      const checkout = new Razorpay({
        key: createOrder.keyId,
        amount: createOrder.amountPaise,
        currency: createOrder.currency,
        name: "StudioVerse",
        description: `Purchase ${createOrder.credits} credits`,
        order_id: createOrder.razorpayOrderId,
        prefill: {
          name: userCtx.name,
        },
        notes: {
          internalOrderId: localOrderId,
          packageName: selected.name,
        },
        theme: {
          color: "#01696f",
        },
        handler: async (payload: RazorpayHandlerResponse) => {
          paymentHandledRef.current = true;
          try {
            await postWithAuth<{ ok: boolean }>("/api/payments/razorpay/verify", token, {
              expectedAmountPaise: createOrder.amountPaise,
              razorpayOrderId: payload.razorpay_order_id,
              razorpayPaymentId: payload.razorpay_payment_id,
              razorpaySignature: payload.razorpay_signature,
            });

            await updateCoinOrderStatus(localOrderId, "completed");
            await assignCoins({
              userId: userCtx.profileId,
              tenantId,
              userType: userCtx.userType,
              userName: userCtx.name,
              coinsToAssign: selected.credits,
              assignedBy: userCtx.profileId,
            });

            setFlow("success");
          } catch (verifyError) {
            const message = verifyError instanceof Error ? verifyError.message : "Payment verification failed.";
            try {
              await updateCoinOrderStatus(localOrderId, "failed");
            } catch {
              // Ignore status update failure here; surface original payment error.
            }
            setInitError(message);
            setFlow("failed");
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: async () => {
            if (paymentHandledRef.current) {
              return;
            }
            try {
              await updateCoinOrderStatus(localOrderId, "failed");
            } catch {
              // Ignore fail-status update errors and still show failed state.
            }
            setInitError("Checkout closed by user.");
            setFlow("failed");
            setProcessing(false);
          },
        },
      });

      checkout.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start payment.";
      setInitError(message);
      setFlow("failed");
      setProcessing(false);
    }
  }

  function resetFlow() {
    paymentHandledRef.current = false;
    setSelected(null);
    setOrderId(null);
    setFlow("browse");
    setInitError("");
  }

  if (loadingInit) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <p className={styles.subtitle}>Loading…</p>
          </div>
        </div>
      </main>
    );
  }

  // ── Success ──────────────────────────────────────────────
  if (flow === "success" && selected) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={buyStyles.successBox}>
              <p className={buyStyles.successIcon}>✅</p>
              <h2 className={buyStyles.successTitle}>Payment Successful!</h2>
              <p className={buyStyles.successBody}>
                <strong>{selected.credits} credits</strong> from the{" "}
                <strong>{selected.name}</strong> package have been added to your wallet.
              </p>
              {orderId ? (
                <p style={{ fontSize: "0.8rem", color: "#4d6e86", marginBottom: "20px" }}>
                  Order ref: {orderId}
                </p>
              ) : null}
              <Link href={`${basePath}/manage-wallet`} className={buyStyles.primaryButton}>
                Go to Wallet
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Failed ───────────────────────────────────────────────
  if (flow === "failed") {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <div className={buyStyles.successBox}>
              <p className={buyStyles.successIcon}>❌</p>
              <h2 className={buyStyles.successTitle}>Payment Failed</h2>
              <p className={buyStyles.successBody}>
                Your payment could not be processed. No credits have been added to your wallet.
              </p>
              {orderId ? (
                <p style={{ fontSize: "0.8rem", color: "#4d6e86", marginBottom: "8px" }}>
                  Order ref: {orderId} — status: failed
                </p>
              ) : null}
              <p style={{ fontSize: "0.85rem", color: "#4d6e86", marginBottom: "24px" }}>
                You can retry the purchase below or contact support if the problem persists.
              </p>
              {initError ? (
                <p style={{ fontSize: "0.85rem", color: "#b3261e", marginBottom: "18px" }}>
                  Reason: {initError}
                </p>
              ) : null}
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button type="button" className={buyStyles.primaryButton} onClick={resetFlow}>
                  Try Again
                </button>
                <Link href={`${basePath}/manage-wallet`} className={buyStyles.secondaryButton}>
                  Wallet
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Order summary ─────────────────────────────────────────
  if (flow === "summary" && selected) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.card}>
            <button
              type="button"
              className={buyStyles.backLink}
              onClick={resetFlow}
            >
              ← Back to Packages
            </button>
            <h1 className={styles.title} style={{ marginTop: "16px" }}>Order Summary</h1>

            {selected.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt={selected.name}
                style={{ width: "100%", maxHeight: "160px", objectFit: "cover", borderRadius: "12px", marginBottom: "16px" }}
              />
            ) : null}

            <div className={buyStyles.summaryCard}>
              <div className={buyStyles.summaryRow}>
                <span className={buyStyles.summaryLabel}>Package</span>
                <span className={buyStyles.summaryValue}>{selected.name}</span>
              </div>
              <div className={buyStyles.summaryRow}>
                <span className={buyStyles.summaryLabel}>Credits</span>
                <span className={buyStyles.summaryValue}>{selected.credits} credits</span>
              </div>
              <div className={buyStyles.summaryRow}>
                <span className={buyStyles.summaryLabel}>Amount</span>
                <span className={buyStyles.summaryValue}>
                  ₹{selected.priceInr.toLocaleString("en-IN")}
                </span>
              </div>
              {userCtx ? (
                <div className={buyStyles.summaryRow}>
                  <span className={buyStyles.summaryLabel}>Billing to</span>
                  <span className={buyStyles.summaryValue}>{userCtx.name}</span>
                </div>
              ) : null}
            </div>

            {initError ? <p style={{ color: "#c0392b", marginTop: "12px" }}>{initError}</p> : null}

            <div className={buyStyles.summaryActions}>
              <button
                type="button"
                className={buyStyles.primaryButton}
                onClick={handleConfirmOrder}
                disabled={processing}
              >
                {processing ? "Opening checkout..." : `Pay ₹${selected.priceInr.toLocaleString("en-IN")}`}
              </button>
              <button
                type="button"
                className={buyStyles.secondaryButton}
                onClick={resetFlow}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── Browse packages ───────────────────────────────────────
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.card}>
          <div style={{ marginBottom: "16px" }}>
            <button type="button" className={buyStyles.backLink} onClick={() => router.back()}>
              ← Back
            </button>
          </div>

          <h1 className={styles.title}>Buy Credits</h1>
          <p className={styles.subtitle}>Choose a package to top up your wallet.</p>

          {initError ? <p style={{ color: "#c0392b", marginTop: "12px" }}>{initError}</p> : null}

          {packages.length === 0 ? (
            <div className={buyStyles.emptyState}>
              <p>No packages available at the moment. Please check back soon.</p>
            </div>
          ) : (
            <div className={buyStyles.packagesGrid}>
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  className={buyStyles.packageCard}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  {pkg.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pkg.imageUrl}
                      alt={pkg.name}
                      style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "10px", marginBottom: "8px" }}
                    />
                  ) : null}
                  <p className={buyStyles.packageName}>{pkg.name}</p>
                  {pkg.description ? (
                    <p className={buyStyles.packageDesc}>{pkg.description}</p>
                  ) : null}
                  <p className={buyStyles.packageCredits}>{pkg.credits} credits</p>
                  <p className={buyStyles.packagePrice}>
                    ₹{pkg.priceInr.toLocaleString("en-IN")}
                  </p>
                  <span className={buyStyles.selectBtn}>Buy Now</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <Link href={`${basePath}/manage-wallet`} style={{ color: "#01696f", fontWeight: 600 }}>
              Return to Manage Wallet
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
