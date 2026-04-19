"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./ManageWalletPage.module.css";

type BuyCoinsPageProps = {
  tenantId?: string;
};

export default function BuyCoinsPage({ tenantId = "coaching-studio" }: BuyCoinsPageProps) {
  const router = useRouter();
  const basePath = `/${tenantId}`;

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.card}>
          <div style={{ marginBottom: "24px" }}>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => router.back()}
              style={{
                border: "1px solid #c6dcea",
                borderRadius: "12px",
                padding: "8px 12px",
                background: "#fff",
                color: "#133a56",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              ← Back
            </button>
          </div>

          <h1 className={styles.title}>Buy Coins</h1>
          <p className={styles.subtitle}>Purchase additional coins to use within the platform.</p>

          <div
            style={{
              border: "2px dashed #c6dcea",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              background: "#f8fcff",
              marginTop: "32px",
            }}
          >
            <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#133a56", margin: "0 0 12px 0" }}>
              💳 Coin Purchase
            </p>
            <p style={{ color: "#4d6e86", margin: "0 0 24px 0" }}>
              This feature is coming soon. You will be able to purchase coins directly from this page.
            </p>
            <p style={{ color: "#4d6e86", fontSize: "0.9rem", margin: 0 }}>
              Select a package and complete payment to add coins to your wallet.
            </p>
          </div>

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <Link href={`${basePath}/manage-wallet`} className={styles.button} style={{ display: "inline-block" }}>
              Return to Manage Wallet
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
