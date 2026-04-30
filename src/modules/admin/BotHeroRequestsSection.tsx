"use client";

import styles from "./SuperAdminPortal.module.css";

export default function BotHeroRequestsSection() {
  return (
    <article className={styles.card}>
      <h2>Bot Hero Requests</h2>
      <p className={styles.subtitle}>
        Review and approve pending bot hero image and persona requests from professionals.
      </p>
      <div className={styles.emptyCard}>Bot Hero request approvals coming soon.</div>
    </article>
  );
}
