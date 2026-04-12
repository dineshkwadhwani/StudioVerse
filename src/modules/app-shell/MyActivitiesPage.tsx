import type { TenantConfig } from "@/types/tenant";
import TenantMyActivitiesPage from "@/modules/coaching-studio/MyActivitiesPage";

type Props = { tenantConfig: TenantConfig };

export default function MyActivitiesPage({ tenantConfig }: Props) {
  return <TenantMyActivitiesPage tenantConfig={tenantConfig} />;
}
