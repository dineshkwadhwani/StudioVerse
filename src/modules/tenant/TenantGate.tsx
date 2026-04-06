"use client";

import React from "react";
import { useTenantByContext } from "@/hooks/useTenantByContext";
import styles from "./TenantGate.module.css";

type Props = {
  rootContext: string;
  children: React.ReactNode;
};

export default function TenantGate({ rootContext, children }: Props) {
  const { status, tenant, error } = useTenantByContext(rootContext);

  if (status === "loading") {
    return (
      <main className={styles.state}>
        <div className={styles.spinner} aria-label="Loading" />
        <p>Loading...</p>
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className={styles.state}>
        <h1 className={styles.heading}>Studio not found</h1>
        <p className={styles.body}>
          No tenant is configured for <strong>{rootContext}</strong>.
          Please check the URL or contact your administrator.
        </p>
      </main>
    );
  }

  if (status === "inactive") {
    return (
      <main className={styles.state}>
        <h1 className={styles.heading}>{tenant?.tenantName ?? "This Studio"} is currently offline</h1>
        <p className={styles.body}>
          This tenant has been deactivated. Please contact your administrator.
        </p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className={styles.state}>
        <h1 className={styles.heading}>Unable to load this Studio</h1>
        <p className={styles.body}>{error ?? "An unexpected error occurred."}</p>
      </main>
    );
  }

  return <>{children}</>;
}
