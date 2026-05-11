"use client";

import { useEffect, useState } from "react";
import { getTenantSearchConfig } from "@/services/search.service";
import type { SearchMenuConfig } from "@/modules/activities/config/menuConfig";

export function useTenantSearchConfig(tenantId: string): SearchMenuConfig {
  const [config, setConfig] = useState<SearchMenuConfig>({ enabled: false });

  useEffect(() => {
    if (!tenantId.trim()) return;
    getTenantSearchConfig(tenantId).then((cfg) => setConfig(cfg));
  }, [tenantId]);

  return config;
}
