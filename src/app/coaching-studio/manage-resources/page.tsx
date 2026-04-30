import { config } from "@/tenants/coaching-studio/config";
import ManageResourcesPage from "@/modules/resources/pages/ManageResourcesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioManageResourcesRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ManageResourcesPage config={config} showAssessments={false} />
    </TenantGate>
  );
}
