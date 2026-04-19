import type { TenantConfig } from "@/types/tenant";
import TenantManageReferralsPage from "@/modules/referrals/pages/ManageReferralsPage";

type Props = { tenantConfig: TenantConfig };

export default function ManageReferralsPage({ tenantConfig }: Props) {
  return <TenantManageReferralsPage tenantConfig={tenantConfig} />;
}
