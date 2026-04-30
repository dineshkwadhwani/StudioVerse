import { config } from "@/tenants/training-studio/config";
import ManageResourcesPage from "@/modules/resources/pages/ManageResourcesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioManageResourcesRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ManageResourcesPage config={config} showAssessments={false} />
    </TenantGate>
  );
}
