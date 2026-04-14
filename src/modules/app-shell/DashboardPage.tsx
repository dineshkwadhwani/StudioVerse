import type { TenantConfig } from "@/types/tenant";
import TenantDashboardPage from "@/modules/dashboard/pages/DashboardPage";

type Props = { tenantConfig: TenantConfig };

export default function DashboardPage({ tenantConfig }: Props) {
  return <TenantDashboardPage tenantConfig={tenantConfig} />;
}
