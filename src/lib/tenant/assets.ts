const DEFAULT_TENANT_ID = "coaching-studio";

function normalizeTenantId(tenantId?: string): string {
  const value = (tenantId ?? "").trim();
  return value || DEFAULT_TENANT_ID;
}

export function tenantAssetPath(tenantId: string | undefined, assetFile: string): string {
  return `/tenants/${normalizeTenantId(tenantId)}/${assetFile}`;
}
