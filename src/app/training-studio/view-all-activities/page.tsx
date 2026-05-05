import { config } from "@/tenants/training-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import ViewAllActivitiesPage from "@/modules/activities/pages/ViewAllActivitiesPage";

export default function TrainingStudioViewAllActivitiesRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ViewAllActivitiesPage tenantId="training-studio" config={config} showHeader={true} />
    </TenantGate>
  );
}
