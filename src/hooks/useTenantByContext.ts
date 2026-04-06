"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/services/firebase";

export type TenantStatus = "loading" | "active" | "inactive" | "not-found" | "error";

export type TenantRecord = {
  tenantId: string;
  tenantName: string;
  domainName: string;
  rootContext: string;
  status: "active" | "inactive";
};

export function useTenantByContext(rootContext: string): {
  status: TenantStatus;
  tenant: TenantRecord | null;
  error: string | null;
} {
  const [status, setStatus] = useState<TenantStatus>("loading");
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTenant() {
      try {
        const q = query(
          collection(db, "tenants"),
          where("rootContext", "==", rootContext),
          limit(1)
        );

        const snap = await getDocs(q);

        if (cancelled) {
          return;
        }

        if (snap.empty) {
          setStatus("not-found");
          setTenant(null);
          return;
        }

        const data = snap.docs[0].data() as TenantRecord;

        if (data.status !== "active") {
          setStatus("inactive");
          setTenant(data);
          return;
        }

        setTenant(data);
        setStatus("active");
      } catch (err) {
        if (cancelled) {
          return;
        }

        const message = err instanceof Error ? err.message : "Failed to load tenant.";
        setError(message);
        setStatus("error");
      }
    }

    void fetchTenant();

    return () => {
      cancelled = true;
    };
  }, [rootContext]);

  return { status, tenant, error };
}
