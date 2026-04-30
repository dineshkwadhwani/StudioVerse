"use client";

import styles from "./SuperAdminPortal.module.css";

export default function ListingRequestsSection() {
  return (
    <article className={styles.card}>
      <h2>Listing Requests</h2>
      <p className={styles.subtitle}>
        Review and approve pending listing requests across tenants.
      </p>
      <div className={styles.emptyCard}>Listing request approvals coming soon.</div>
    </article>
  );
}
