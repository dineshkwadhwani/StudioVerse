import { TENANT_CONFIGS } from "@/tenants";
import type { TenantConfig } from "@/types/tenant";

const SHARED_TENANT_PATHS = [
  "/auth",
  "/dashboard",
  "/tools",
  "/programs",
  "/events",
  "/manage-wallet",
  "/my-activities",
  "/profile",
  "/privacy-policy",
] as const;

function normalizeHost(host: string): string {
  const withoutPort = host.split(":")[0] ?? "";
  return withoutPort.toLowerCase().replace(/^www\./, "");
}

export function resolveTenantByHost(host: string): TenantConfig | undefined {
  const normalized = normalizeHost(host);
  return TENANT_CONFIGS.find((tenant) => {
    const tenantHost = normalizeHost(tenant.domain);
    return normalized === tenantHost || normalized.endsWith(`.${tenantHost}`);
  });
}

export function isTenantRootPath(pathname: string): boolean {
  return TENANT_CONFIGS.some((tenant) => pathname === `/${tenant.id}` || pathname.startsWith(`/${tenant.id}/`));
}

export function isSharedTenantPath(pathname: string): boolean {
  return SHARED_TENANT_PATHS.includes(pathname as (typeof SHARED_TENANT_PATHS)[number]);
}
