import { config } from "@/tenants/coaching-studio/config";
import ManageProgramsPage from "@/modules/programs/pages/ManageProgramsPage";
import TenantGate from "@/modules/tenant/TenantGate";

export default function CoachingStudioManageProgramsRoutePage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ManageProgramsPage config={config} />
    </TenantGate>
  );
}
