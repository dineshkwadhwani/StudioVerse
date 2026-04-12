import { config } from "@/tenants/coaching-studio/config";
import ProgramsPage from "@/modules/app-shell/ProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioProgramsRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ProgramsPage tenantConfig={config} />
    </TenantGate>
  );
}
