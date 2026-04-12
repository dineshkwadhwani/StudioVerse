import TenantGate from "@/modules/tenant/TenantGate";
import ToolsPage from "@/modules/app-shell/ToolsPage";
import { config } from "@/tenants/recruitment-studio/config";

export default function RecruitmentStudioToolsPage() {
  return (
    <TenantGate rootContext="recruitment-studio">
      <ToolsPage tenantConfig={config} />
    </TenantGate>
  );
}
