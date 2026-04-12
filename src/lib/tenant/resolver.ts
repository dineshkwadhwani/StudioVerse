import { TenantConfig } from "@/types/tenant";
import { TENANT_CONFIGS } from "@/tenants";

const FALLBACK_TENANT_ID = "coaching-studio";

function resolveEnvTenantId(): string | undefined {
  if (process.env.NEXT_PUBLIC_TENANT_ID) {
    return process.env.NEXT_PUBLIC_TENANT_ID;
  }

  const studioType = process.env.NEXT_PUBLIC_STUDIO_TYPE;
  if (studioType === "coaching") return "coaching-studio";
  if (studioType === "training") return "training-studio";
  if (studioType === "recruitment") return "recruitment-studio";

  return undefined;
}

export function resolveTenant(): TenantConfig {
  const envTenant = resolveEnvTenantId();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";

  const fallbackTenant =
    TENANT_CONFIGS.find((tenant) => tenant.id === FALLBACK_TENANT_ID) ?? TENANT_CONFIGS[0];

  return (
    TENANT_CONFIGS.find(
      (t) => t.id === envTenant || hostname.includes(t.domain)
    ) ?? fallbackTenant
  );
}