import { getTenantConfigById } from "@/tenants";
import type { TenantConfig } from "@/types/tenant";

export type StudioType = "coaching" | "training" | "recruitment";

const STUDIO_TO_TENANT: Record<StudioType, string> = {
  coaching: "coaching-studio",
  training: "training-studio",
  recruitment: "recruitment-studio",
};

export function getStudioConfig(studioType?: StudioType): TenantConfig {
  const activeStudio =
    studioType ||
    (process.env.NEXT_PUBLIC_STUDIO_TYPE as StudioType | undefined) ||
    "coaching";

  const matched = getTenantConfigById(STUDIO_TO_TENANT[activeStudio]);
  if (matched) {
    return matched;
  }

  const fallback = getTenantConfigById("coaching-studio");
  if (!fallback) {
    throw new Error("Tenant configuration missing for coaching-studio.");
  }

  return fallback;
}

export const studioConfig = getStudioConfig();