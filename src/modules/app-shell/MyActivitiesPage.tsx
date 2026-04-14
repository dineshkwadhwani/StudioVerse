import type { TenantConfig } from "@/types/tenant";
import TenantMyActivitiesPage from "@/modules/activities/pages/MyActivitiesPage";

type Props = { tenantConfig: TenantConfig };

export default function MyActivitiesPage({ tenantConfig }: Props) {
  return <TenantMyActivitiesPage tenantConfig={tenantConfig} />;
}
