import TenantGate from "@/modules/tenant/TenantGate";
import ToolsPage from "@/modules/app-shell/ToolsPage";
import { config } from "@/tenants/coaching-studio/config";

export default function CoachingStudioToolsPage() {
  return (
    <TenantGate rootContext="coaching-studio">
      <ToolsPage tenantConfig={config} />
    </TenantGate>
  );
}
