import { TenantConfig } from "@/types/tenant";
import { TENANT_CONFIGS } from "@/tenants";
import { resolveTenantByHost } from "@/lib/tenant/routing";

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
  // 1. Env-based resolution (for local dev and path-based Vercel deployments)
  const envTenant = resolveEnvTenantId();
  if (envTenant) {
    const matched = TENANT_CONFIGS.find((t) => t.id === envTenant);
    if (matched) return matched;
  }

  // 2. Domain-based resolution (for custom domain production deployments)
  //    Uses the same exact/subdomain matching as the middleware proxy.
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (hostname) {
    const matched = resolveTenantByHost(hostname);
    if (matched) return matched;
  }

  throw new Error(
    "Unable to resolve tenant. Set NEXT_PUBLIC_TENANT_ID/NEXT_PUBLIC_STUDIO_TYPE or use a mapped tenant domain.",
  );
}