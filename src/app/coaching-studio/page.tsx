import TenantGate from "@/modules/tenant/TenantGate";
import CoachingLandingPage from "@/modules/coaching-studio/CoachingLandingPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioPage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <CoachingLandingPage config={config} />
    </TenantGate>
  );
}