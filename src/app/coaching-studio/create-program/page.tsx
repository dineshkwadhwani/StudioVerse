import { config } from "@/tenants/coaching-studio/config";
import CreateProgramPage from "@/modules/programs/pages/CreateProgramPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioCreateProgramRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <CreateProgramPage config={config} />
    </TenantGate>
  );
}
