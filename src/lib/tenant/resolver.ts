import { TenantConfig } from "@/types/tenant";
import { config as coachingConfig } from "@/tenants/coaching-studio/config";
import { config as technicalConfig } from "@/tenants/technical-studio/config";
import { config as recruitmentConfig } from "@/tenants/recruitment-studio/config";

const TENANTS: TenantConfig[] = [
  coachingConfig,
  technicalConfig,
  recruitmentConfig,
];

export function resolveTenant(): TenantConfig {
  const envTenant = process.env.NEXT_PUBLIC_TENANT_ID;
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  return (
    TENANTS.find(
      (t) => t.id === envTenant || hostname.includes(t.domain)
    ) ?? coachingConfig
  );
}