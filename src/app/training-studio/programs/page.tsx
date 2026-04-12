import { config } from "@/tenants/training-studio/config";
import ProgramsPage from "@/modules/app-shell/ProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioProgramsRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ProgramsPage tenantConfig={config} />
    </TenantGate>
  );
}
