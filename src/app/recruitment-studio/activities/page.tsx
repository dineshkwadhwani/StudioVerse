import { config } from "@/tenants/recruitment-studio/config";
import ActivitiesPage from "@/modules/app-shell/ActivitiesPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioActivitiesRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ActivitiesPage tenantConfig={config} />
    </TenantGate>
  );
}
