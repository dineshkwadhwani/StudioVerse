import { config } from "@/tenants/coaching-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import ViewAllActivitiesPage from "@/modules/activities/pages/ViewAllActivitiesPage";

export default function CoachingStudioViewAllActivitiesRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ViewAllActivitiesPage tenantId="coaching-studio" config={config} showHeader={true} />
    </TenantGate>
  );
}
