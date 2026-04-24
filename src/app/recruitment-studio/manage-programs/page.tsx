import { config } from "@/tenants/recruitment-studio/config";
import ManageProgramsPage from "@/modules/programs/pages/ManageProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioManageProgramsRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ManageProgramsPage config={config} />
    </TenantGate>
  );
}
