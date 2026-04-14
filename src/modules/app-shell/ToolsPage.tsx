import type { TenantConfig } from "@/types/tenant";
import TenantToolsPage from "@/modules/tools/pages/ToolsPage";

type Props = { tenantConfig: TenantConfig };

export default function ToolsPage({ tenantConfig }: Props) {
  return <TenantToolsPage config={tenantConfig} />;
}
