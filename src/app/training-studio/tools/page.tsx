import TenantGate from "@/modules/tenant/TenantGate";
import ToolsPage from "@/modules/app-shell/ToolsPage";
import { config } from "@/tenants/training-studio/config";

export default function TrainingStudioToolsPage() {
  return (
    <TenantGate rootContext="training-studio">
      <ToolsPage tenantConfig={config} />
    </TenantGate>
  );
}
