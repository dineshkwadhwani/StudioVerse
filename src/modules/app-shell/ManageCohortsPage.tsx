import type { TenantConfig } from "@/types/tenant";
import TenantManageCohortsPage from "@/modules/cohorts/pages/ManageCohortsPage";

type Props = { tenantConfig: TenantConfig };

export default function ManageCohortsPage({ tenantConfig }: Props) {
  return <TenantManageCohortsPage tenantConfig={tenantConfig} />;
}
