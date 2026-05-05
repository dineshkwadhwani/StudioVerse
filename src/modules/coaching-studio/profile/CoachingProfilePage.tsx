import TenantProfilePage from "@/modules/profile/pages/ProfilePage";
import { config as coachingTenantConfig } from "@/tenants/coaching-studio/config";
import type { TenantConfig } from "@/types/tenant";

type ProfilePageProps = {
  tenantConfig?: TenantConfig;
};

export default function CoachingProfilePage({ tenantConfig = coachingTenantConfig }: ProfilePageProps) {
  return <TenantProfilePage tenantConfig={tenantConfig} />;
}
