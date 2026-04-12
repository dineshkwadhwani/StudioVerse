import TenantGate from "@/modules/tenant/TenantGate";
import LandingPage from "@/modules/app-shell/LandingPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioPage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <LandingPage tenantConfig={config} />
    </TenantGate>
  );
}