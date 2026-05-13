import { getTenantConfigById } from "@/tenants";
import type { TenantConfig } from "@/types/tenant";

export type StudioType = "coaching" | "training" | "recruitment";

const STUDIO_TO_TENANT: Record<StudioType, string> = {
  coaching: "coaching-studio",
  training: "training-studio",
  recruitment: "recruitment-studio",
};

export function getStudioConfig(studioType?: StudioType): TenantConfig {
  const envTenantId = process.env.NEXT_PUBLIC_TENANT_ID;
  const activeStudio = studioType || (process.env.NEXT_PUBLIC_STUDIO_TYPE as StudioType | undefined);
  const requestedTenantId = envTenantId || (activeStudio ? STUDIO_TO_TENANT[activeStudio] : undefined);

  if (!requestedTenantId) {
    throw new Error("Unable to resolve studio config. Set NEXT_PUBLIC_TENANT_ID or NEXT_PUBLIC_STUDIO_TYPE.");
  }

  const matched = getTenantConfigById(requestedTenantId);
  if (matched) {
    return matched;
  }

  throw new Error(`Tenant configuration missing for ${requestedTenantId}.`);
}

export const studioConfig = getStudioConfig();