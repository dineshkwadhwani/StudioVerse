import { config } from "@/tenants/training-studio/config";
import CreateProgramPage from "@/modules/programs/pages/CreateProgramPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function TrainingStudioCreateProgramRoutePage() {
  return (
    <TenantGate rootContext="training-studio">
      <CreateProgramPage config={config} />
    </TenantGate>
  );
}
