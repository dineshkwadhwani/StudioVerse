"use client";

import { useEffect, useState } from "react";
import { getTenantReferralsConfig } from "@/services/search.service";
import type { ReferralsMenuConfig } from "@/modules/activities/config/menuConfig";

export function useTenantReferralsConfig(tenantId: string): ReferralsMenuConfig {
  const [config, setConfig] = useState<ReferralsMenuConfig>({ enabled: true });

  useEffect(() => {
    if (!tenantId.trim()) return;
    getTenantReferralsConfig(tenantId).then((cfg) => setConfig(cfg));
  }, [tenantId]);

  return config;
}
