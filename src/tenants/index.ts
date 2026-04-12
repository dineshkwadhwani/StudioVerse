import type { TenantConfig } from "@/types/tenant";
import { config as coachingConfig } from "@/tenants/coaching-studio/config";
import { config as trainingConfig } from "@/tenants/training-studio/config";
import { config as recruitmentConfig } from "@/tenants/recruitment-studio/config";

export const TENANT_CONFIGS: TenantConfig[] = [
  coachingConfig,
  trainingConfig,
  recruitmentConfig,
];

export function getTenantConfigById(tenantId: string): TenantConfig | undefined {
  return TENANT_CONFIGS.find((tenant) => tenant.id === tenantId);
}
