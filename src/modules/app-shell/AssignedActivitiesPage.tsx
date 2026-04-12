import type { TenantConfig } from "@/types/tenant";
import TenantAssignedActivitiesPage from "@/modules/coaching-studio/AssignedActivitiesPage";

type Props = { tenantConfig: TenantConfig };

export default function AssignedActivitiesPage({ tenantConfig }: Props) {
  return <TenantAssignedActivitiesPage tenantConfig={tenantConfig} />;
}
