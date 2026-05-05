import { config } from "@/tenants/recruitment-studio/config";
import TenantGate from "@/modules/tenant/TenantGate";
import ViewAllActivitiesPage from "@/modules/activities/pages/ViewAllActivitiesPage";

export default function RecruitmentStudioViewAllActivitiesRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ViewAllActivitiesPage tenantId="recruitment-studio" config={config} showHeader={true} />
    </TenantGate>
  );
}
