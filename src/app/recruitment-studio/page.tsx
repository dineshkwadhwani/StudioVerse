import TenantGate from "@/modules/tenant/TenantGate";
import LandingPage from "@/modules/app-shell/LandingPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioPage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <LandingPage tenantConfig={config} />
    </TenantGate>
  );
}