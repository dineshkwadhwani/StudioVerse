import type { TenantConfig } from "@/types/tenant";
import TenantActivitiesPage from "@/modules/activities/pages/ActivitiesPage";

type Props = { tenantConfig: TenantConfig };

export default function ActivitiesPage({ tenantConfig }: Props) {
  return <TenantActivitiesPage config={tenantConfig} />;
}
