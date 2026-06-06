import { useEffect, useState } from "react";
import { getTenantDevelopmentConfig } from "@/services/search.service";
import type { DevelopmentMenuConfig } from "@/modules/activities/config/menuConfig";

export function useTenantDevelopmentConfig(tenantId: string): DevelopmentMenuConfig {
  const [config, setConfig] = useState<DevelopmentMenuConfig>({ enabled: false });

  useEffect(() => {
    let active = true;
    getTenantDevelopmentConfig(tenantId).then((cfg) => {
      if (active) {
        setConfig({ enabled: cfg.enabled });
      }
    });

    return () => {
      active = false;
    };
  }, [tenantId]);

  return config;
}