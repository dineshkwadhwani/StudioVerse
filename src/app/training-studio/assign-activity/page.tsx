import { config } from "@/tenants/training-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import AssignActivitiesPage from "@/modules/activities/pages/AssignActivitiesPage";

export default function TrainingStudioAssignActivityRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <AssignActivitiesPage tenantId="training-studio" config={config} showHeader />
    </TenantGate>
  );
}
