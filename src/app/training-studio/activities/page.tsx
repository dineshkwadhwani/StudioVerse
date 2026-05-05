import { config } from "@/tenants/training-studio/config";
import ActivitiesPage from "@/modules/app-shell/ActivitiesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioActivitiesRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ActivitiesPage tenantConfig={config} />
    </TenantGate>
  );
}
