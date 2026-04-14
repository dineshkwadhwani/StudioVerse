import type { TenantConfig } from "@/types/tenant";
import TenantProgramsPage from "@/modules/programs/pages/ProgramsPage";

type Props = { tenantConfig: TenantConfig };

export default function ProgramsPage({ tenantConfig }: Props) {
  return <TenantProgramsPage config={tenantConfig} />;
}
