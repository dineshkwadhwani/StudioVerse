import { config } from "@/tenants/recruitment-studio/config";
import ManageResourcesPage from "@/modules/resources/pages/ManageResourcesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioManageResourcesRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ManageResourcesPage config={config} showAssessments={false} />
    </TenantGate>
  );
}
