import { config } from "@/tenants/coaching-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import AssignActivitiesPage from "@/modules/activities/pages/AssignActivitiesPage";

export default function CoachingStudioAssignActivityRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <AssignActivitiesPage tenantId="coaching-studio" config={config} showHeader />
    </TenantGate>
  );
}
