import { config } from "@/tenants/coaching-studio/config";
import CoachingProgramsPage from "@/modules/coaching-studio/CoachingProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioProgramsRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <CoachingProgramsPage config={config} />
    </TenantGate>
  );
}
