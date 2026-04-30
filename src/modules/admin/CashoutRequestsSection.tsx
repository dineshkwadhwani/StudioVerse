"use client";

import styles from "./SuperAdminPortal.module.css";

export default function CashoutRequestsSection() {
  return (
    <article className={styles.card}>
      <h2>Cashout Requests</h2>
      <p className={styles.subtitle}>
        Review and approve pending cashout requests from professionals and individuals.
      </p>
      <div className={styles.emptyCard}>Cashout request approvals coming soon.</div>
    </article>
  );
}
