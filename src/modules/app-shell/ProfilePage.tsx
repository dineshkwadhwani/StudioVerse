import type { TenantConfig } from "@/types/tenant";
import TenantProfilePage from "@/modules/profile/pages/ProfilePage";

type Props = { tenantConfig: TenantConfig };

export default function ProfilePage({ tenantConfig }: Props) {
  return <TenantProfilePage tenantConfig={tenantConfig} />;
}
