"use client";

import { useState } from "react";
import styles from "./LocalCheckoutOverlay.module.css";

type LocalCheckoutOverlayProps = {
  packageName: string;
  credits: number;
  amountPaise: number;
  razorpayOrderId: string;
  onSimulateSuccess: () => Promise<void>;
  onSimulateFailure: () => Promise<void>;
};

export default function LocalCheckoutOverlay({
  packageName,
  credits,
  amountPaise,
  razorpayOrderId,
  onSimulateSuccess,
  onSimulateFailure,
}: LocalCheckoutOverlayProps) {
  const [busy, setBusy] = useState(false);

  const amountInr = (amountPaise / 100).toLocaleString("en-IN");

  async function handleClick(action: "success" | "failure") {
    setBusy(true);
    if (action === "success") {
      await onSimulateSuccess();
    } else {
      await onSimulateFailure();
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <div className={styles.header}>Local Payment Emulator</div>
        <div className={styles.body}>
          <h2 className={styles.title}>Checkout</h2>

          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Package</span>
            <span className={styles.detailValue}>{packageName}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Credits</span>
            <span className={styles.detailValue}>{credits}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Amount</span>
            <span className={styles.detailValue}>&#8377;{amountInr}</span>
          </div>

          <p className={styles.orderId}>Order: {razorpayOrderId}</p>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.successButton}
              disabled={busy}
              onClick={() => void handleClick("success")}
            >
              {busy ? "Processing..." : "Simulate Success"}
            </button>
            <button
              type="button"
              className={styles.failureButton}
              disabled={busy}
              onClick={() => void handleClick("failure")}
            >
              Simulate Failure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
