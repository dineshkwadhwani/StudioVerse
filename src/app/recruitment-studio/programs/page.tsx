import { config } from "@/tenants/recruitment-studio/config";
import ProgramsPage from "@/modules/app-shell/ProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioProgramsRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ProgramsPage tenantConfig={config} />
    </TenantGate>
  );
}
