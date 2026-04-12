import TenantGate from "@/modules/tenant/TenantGate";
import LandingPage from "@/modules/app-shell/LandingPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioPage() {
  return (
    <TenantGate rootContext="training-studio">
      <LandingPage tenantConfig={config} />
    </TenantGate>
  );
}