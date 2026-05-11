import { config } from "@/tenants/recruitment-studio/config";
import CreateProgramPage from "@/modules/programs/pages/CreateProgramPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function RecruitmentStudioCreateProgramRoutePage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <CreateProgramPage config={config} />
    </TenantGate>
  );
}
