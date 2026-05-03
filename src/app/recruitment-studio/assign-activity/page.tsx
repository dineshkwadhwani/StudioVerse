import { config } from "@/tenants/recruitment-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import AssignActivitiesPage from "@/modules/activities/pages/AssignActivitiesPage";

export default function RecruitmentStudioAssignActivityRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <AssignActivitiesPage tenantId="recruitment-studio" config={config} showHeader />
    </TenantGate>
  );
}
