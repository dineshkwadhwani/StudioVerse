import { config } from "@/tenants/training-studio/config";
import ManageProgramsPage from "@/modules/programs/pages/ManageProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioManageProgramsRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <ManageProgramsPage config={config} />
    </TenantGate>
  );
}
