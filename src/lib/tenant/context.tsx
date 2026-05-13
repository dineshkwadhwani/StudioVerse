"use client";

import React, { createContext, useContext } from "react";
import { TenantConfig } from "@/types/tenant";
import { resolveTenant } from "./resolver";

const TenantContext = createContext<TenantConfig | null>(null);

type TenantProviderProps = {
  children: React.ReactNode;
  /** Explicitly provided config (preferred from tenant layouts). Falls back to runtime resolution if omitted. */
  tenantConfig?: TenantConfig;
};

export function TenantProvider({ children, tenantConfig }: TenantProviderProps) {
  const tenant = tenantConfig ?? resolveTenant();
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantConfig {
  const tenant = useContext(TenantContext);
  if (!tenant) {
    throw new Error("Tenant context missing. Wrap this tree with TenantProvider.");
  }
  return tenant;
}