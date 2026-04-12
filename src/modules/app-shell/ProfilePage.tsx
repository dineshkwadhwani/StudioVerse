import type { TenantConfig } from "@/types/tenant";
import TenantProfilePage from "@/modules/coaching-studio/profile/CoachingProfilePage";

type Props = { tenantConfig: TenantConfig };

export default function ProfilePage({ tenantConfig }: Props) {
  return <TenantProfilePage tenantConfig={tenantConfig} />;
}
