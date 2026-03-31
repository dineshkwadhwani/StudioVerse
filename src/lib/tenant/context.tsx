"use client";

import React, { createContext, useContext } from "react";
import { TenantConfig } from "@/types/tenant";
import { resolveTenant } from "./resolver";

const TenantContext = createContext<TenantConfig>(resolveTenant());

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const tenant = resolveTenant();
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);