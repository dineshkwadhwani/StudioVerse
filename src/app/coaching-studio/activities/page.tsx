import { config } from "@/tenants/coaching-studio/config";
import ActivitiesPage from "@/modules/app-shell/ActivitiesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioActivitiesRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ActivitiesPage tenantConfig={config} />
    </TenantGate>
  );
}
